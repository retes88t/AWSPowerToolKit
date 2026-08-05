using System.Text.Json;
using System.Text.Json.Serialization;
using Amazon.Runtime;
using Amazon.SQS;
using Amazon.SQS.Model;

namespace AWSPowerToolKit.Desktop.Bridge;

/// <summary>
/// Handlers .NET para el módulo SQS, invocados desde el <see cref="BridgeRouter"/> (T4)
/// una vez que T10 los registre. Replica exactamente las operaciones de
/// <c>src/aws/sqsService.ts</c> (mismos nombres de campos de AWS, mismo paginado, mismo
/// dedupe, mismo comportamiento FIFO) para que el frontend (T9, <c>src/bridge/sqsBridge.ts</c>)
/// pueda envolver estas acciones con la misma firma que ya expone <c>sqsService.ts</c>.
///
/// Cada método público tiene la firma <c>Task&lt;object&gt; (JsonElement payload)</c>, o sea
/// exactamente <c>Func&lt;JsonElement, Task&lt;object&gt;&gt;</c>, para que T10 pueda registrarlos
/// directamente sin wrapping adicional:
/// <code>
/// router.RegisterHandler("sqs.listQueues", sqsHandlers.ListQueues);
/// router.RegisterHandler("sqs.getQueueSummary", sqsHandlers.GetQueueSummary);
/// router.RegisterHandler("sqs.receiveMessages", sqsHandlers.ReceiveMessages);
/// router.RegisterHandler("sqs.deleteMessage", sqsHandlers.DeleteMessage);
/// router.RegisterHandler("sqs.releaseMessage", sqsHandlers.ReleaseMessage);
/// router.RegisterHandler("sqs.purgeQueue", sqsHandlers.PurgeQueue);
/// router.RegisterHandler("sqs.sendMessage", sqsHandlers.SendMessage);
/// </code>
///
/// Todos los payloads incluyen <c>connectionId</c>, que se resuelve contra
/// <see cref="AccessStoreService.Load"/>-&gt;<c>SqsConnections</c> (T5) para construir/cachear
/// un <see cref="AmazonSQSClient"/> por conexión (mismo espíritu que <c>clientCache</c> en
/// <c>sqsService.ts</c>).
/// </summary>
public sealed class SqsBridgeHandlers
{
    private static readonly JsonSerializerOptions RequestJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AccessStoreService _accessStoreService;
    private readonly Dictionary<string, AmazonSQSClient> _clientCache = new();

    public SqsBridgeHandlers(AccessStoreService accessStoreService)
    {
        _accessStoreService = accessStoreService;
    }

    // ---- payload/result DTOs (mismo shape camelCase que el frontend) -----------------

    private sealed class QueueSummaryDto
    {
        public string Url { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsFifo { get; set; }
        public int? ApproxMessages { get; set; }
        public int? ApproxMessagesNotVisible { get; set; }
        public int? ApproxMessagesDelayed { get; set; }
        public string? DeadLetterTargetArn { get; set; }
    }

    private sealed class SqsMessageAttributeDto
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    private sealed class SqsMessageDto
    {
        public string MessageId { get; set; } = string.Empty;
        public string ReceiptHandle { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public List<SqsMessageAttributeDto> Attributes { get; set; } = [];
        public Dictionary<string, string> SystemAttributes { get; set; } = [];
        public long ReceivedAt { get; set; }
    }

    private sealed class ReceiveOptionsDto
    {
        public int MaxMessages { get; set; }
        public int VisibilityTimeoutSeconds { get; set; }
        public int WaitTimeSeconds { get; set; }
        public bool ReleaseAfterReceive { get; set; }
    }

    private sealed class SendMessageInputDto
    {
        public string Body { get; set; } = string.Empty;
        public List<SqsMessageAttributeDto> Attributes { get; set; } = [];
        public int? DelaySeconds { get; set; }
        public string? MessageGroupId { get; set; }
        public string? MessageDeduplicationId { get; set; }
    }

    private sealed class ListQueuesRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string? Prefix { get; set; }
    }

    private sealed class QueueRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public QueueSummaryDto Queue { get; set; } = new();
    }

    private sealed class ReceiveMessagesRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public QueueSummaryDto Queue { get; set; } = new();
        public ReceiveOptionsDto Options { get; set; } = new();
    }

    private sealed class ReceiptHandleRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public QueueSummaryDto Queue { get; set; } = new();
        public string ReceiptHandle { get; set; } = string.Empty;
    }

    private sealed class SendMessageRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public QueueSummaryDto Queue { get; set; } = new();
        public SendMessageInputDto Input { get; set; } = new();
    }

    // ---- action handlers ---------------------------------------------------------------

    public async Task<object> ListQueues(JsonElement payload)
    {
        var request = Deserialize<ListQueuesRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        var urls = new List<string>();
        string? nextToken = null;
        do
        {
            var response = await client.ListQueuesAsync(new ListQueuesRequest
            {
                QueueNamePrefix = string.IsNullOrEmpty(request.Prefix) ? null : request.Prefix,
                NextToken = nextToken,
                MaxResults = 1000,
            });
            urls.AddRange(response.QueueUrls ?? []);
            nextToken = response.NextToken;
        } while (!string.IsNullOrEmpty(nextToken));

        return urls.Select(ToQueueSummary).ToList();
    }

    private static readonly List<string> QueueAttributeNames =
    [
        "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible",
        "ApproximateNumberOfMessagesDelayed",
        "RedrivePolicy",
    ];

    public async Task<object> GetQueueSummary(JsonElement payload)
    {
        var request = Deserialize<QueueRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        var response = await client.GetQueueAttributesAsync(new GetQueueAttributesRequest
        {
            QueueUrl = request.Queue.Url,
            AttributeNames = [.. QueueAttributeNames],
        });
        var attrs = response.Attributes ?? [];

        string? deadLetterTargetArn = null;
        if (attrs.TryGetValue("RedrivePolicy", out var redrivePolicyJson) && !string.IsNullOrEmpty(redrivePolicyJson))
        {
            try
            {
                using var redrivePolicy = JsonDocument.Parse(redrivePolicyJson);
                if (redrivePolicy.RootElement.TryGetProperty("deadLetterTargetArn", out var arnElement))
                {
                    deadLetterTargetArn = arnElement.GetString();
                }
            }
            catch (JsonException)
            {
                deadLetterTargetArn = null;
            }
        }

        return new QueueSummaryDto
        {
            Url = request.Queue.Url,
            Name = request.Queue.Name,
            IsFifo = request.Queue.IsFifo,
            ApproxMessages = attrs.TryGetValue("ApproximateNumberOfMessages", out var v1) ? int.Parse(v1) : null,
            ApproxMessagesNotVisible = attrs.TryGetValue("ApproximateNumberOfMessagesNotVisible", out var v2) ? int.Parse(v2) : null,
            ApproxMessagesDelayed = attrs.TryGetValue("ApproximateNumberOfMessagesDelayed", out var v3) ? int.Parse(v3) : null,
            DeadLetterTargetArn = deadLetterTargetArn,
        };
    }

    public async Task<object> ReceiveMessages(JsonElement payload)
    {
        var request = Deserialize<ReceiveMessagesRequestDto>(payload);
        var client = GetClient(request.ConnectionId);
        var options = request.Options;

        var collected = new List<SqsMessageDto>();
        var seen = new HashSet<string>();
        var remaining = options.MaxMessages;

        while (remaining > 0)
        {
            var batchSize = Math.Min(10, remaining);
            var response = await client.ReceiveMessageAsync(new ReceiveMessageRequest
            {
                QueueUrl = request.Queue.Url,
                MaxNumberOfMessages = batchSize,
                VisibilityTimeout = options.VisibilityTimeoutSeconds,
                WaitTimeSeconds = Math.Min(options.WaitTimeSeconds, 20),
                MessageAttributeNames = ["All"],
                MessageSystemAttributeNames = ["All"],
            });

            var messages = response.Messages ?? [];
            if (messages.Count == 0) break;

            foreach (var m in messages)
            {
                if (string.IsNullOrEmpty(m.MessageId) || !seen.Add(m.MessageId)) continue;

                collected.Add(new SqsMessageDto
                {
                    MessageId = m.MessageId,
                    ReceiptHandle = m.ReceiptHandle ?? string.Empty,
                    Body = m.Body ?? string.Empty,
                    Attributes = (m.MessageAttributes ?? [])
                        .Select(kv => new SqsMessageAttributeDto
                        {
                            Name = kv.Key,
                            Type = kv.Value.DataType ?? "String",
                            Value = kv.Value.StringValue ?? string.Empty,
                        })
                        .ToList(),
                    SystemAttributes = m.Attributes ?? [],
                    ReceivedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                });

                if (options.ReleaseAfterReceive && !string.IsNullOrEmpty(m.ReceiptHandle))
                {
                    await client.ChangeMessageVisibilityAsync(new ChangeMessageVisibilityRequest
                    {
                        QueueUrl = request.Queue.Url,
                        ReceiptHandle = m.ReceiptHandle,
                        VisibilityTimeout = 0,
                    });
                }
            }

            remaining -= messages.Count;
            if (messages.Count < batchSize) break;
        }

        return collected;
    }

    public async Task<object> DeleteMessage(JsonElement payload)
    {
        var request = Deserialize<ReceiptHandleRequestDto>(payload);
        var client = GetClient(request.ConnectionId);
        await client.DeleteMessageAsync(new DeleteMessageRequest
        {
            QueueUrl = request.Queue.Url,
            ReceiptHandle = request.ReceiptHandle,
        });
        return new { ok = true };
    }

    public async Task<object> ReleaseMessage(JsonElement payload)
    {
        var request = Deserialize<ReceiptHandleRequestDto>(payload);
        var client = GetClient(request.ConnectionId);
        await client.ChangeMessageVisibilityAsync(new ChangeMessageVisibilityRequest
        {
            QueueUrl = request.Queue.Url,
            ReceiptHandle = request.ReceiptHandle,
            VisibilityTimeout = 0,
        });
        return new { ok = true };
    }

    public async Task<object> PurgeQueue(JsonElement payload)
    {
        var request = Deserialize<QueueRequestDto>(payload);
        var client = GetClient(request.ConnectionId);
        await client.PurgeQueueAsync(new PurgeQueueRequest { QueueUrl = request.Queue.Url });
        return new { ok = true };
    }

    public async Task<object> SendMessage(JsonElement payload)
    {
        var request = Deserialize<SendMessageRequestDto>(payload);
        var client = GetClient(request.ConnectionId);
        var input = request.Input;
        var queue = request.Queue;

        var messageAttributes = new Dictionary<string, MessageAttributeValue>();
        foreach (var attr in input.Attributes)
        {
            if (string.IsNullOrEmpty(attr.Name)) continue;
            messageAttributes[attr.Name] = new MessageAttributeValue
            {
                DataType = string.IsNullOrEmpty(attr.Type) ? "String" : attr.Type,
                StringValue = attr.Value,
            };
        }

        var sendRequest = new SendMessageRequest
        {
            QueueUrl = queue.Url,
            MessageBody = input.Body,
        };

        if (!queue.IsFifo && input.DelaySeconds.HasValue)
        {
            sendRequest.DelaySeconds = input.DelaySeconds.Value;
        }
        if (messageAttributes.Count > 0)
        {
            sendRequest.MessageAttributes = messageAttributes;
        }
        if (queue.IsFifo)
        {
            if (!string.IsNullOrEmpty(input.MessageGroupId))
            {
                sendRequest.MessageGroupId = input.MessageGroupId;
            }
            if (!string.IsNullOrEmpty(input.MessageDeduplicationId))
            {
                sendRequest.MessageDeduplicationId = input.MessageDeduplicationId;
            }
        }

        await client.SendMessageAsync(sendRequest);
        return new { ok = true };
    }

    // ---- helpers ------------------------------------------------------------------------

    private static QueueSummaryDto ToQueueSummary(string url) => new()
    {
        Url = url,
        Name = QueueNameFromUrl(url),
        IsFifo = url.EndsWith(".fifo", StringComparison.Ordinal),
    };

    private static string QueueNameFromUrl(string url)
    {
        var parts = url.Split('/');
        return parts.Length > 0 ? parts[^1] : url;
    }

    private static T Deserialize<T>(JsonElement payload)
    {
        return JsonSerializer.Deserialize<T>(payload, RequestJsonOptions)
            ?? throw new InvalidOperationException($"No se pudo deserializar el payload como {typeof(T).Name}.");
    }

    private AmazonSQSClient GetClient(string connectionId)
    {
        if (string.IsNullOrEmpty(connectionId))
        {
            throw new InvalidOperationException("El payload no incluye 'connectionId'.");
        }

        var store = _accessStoreService.Load();
        var entry = store.SqsConnections.FirstOrDefault(c => c.Id == connectionId)
            ?? throw new InvalidOperationException($"No se encontró ninguna conexión SQS con id '{connectionId}' en access.json.");

        var cacheKey = $"{entry.Id}:{entry.Region}:{entry.AccessKeyId}:{entry.SessionToken ?? string.Empty}";
        if (_clientCache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        AWSCredentials credentials = string.IsNullOrEmpty(entry.SessionToken)
            ? new BasicAWSCredentials(entry.AccessKeyId, entry.SecretAccessKey)
            : new SessionAWSCredentials(entry.AccessKeyId, entry.SecretAccessKey, entry.SessionToken);

        var client = new AmazonSQSClient(credentials, Amazon.RegionEndpoint.GetBySystemName(entry.Region));
        _clientCache[cacheKey] = client;
        return client;
    }
}
