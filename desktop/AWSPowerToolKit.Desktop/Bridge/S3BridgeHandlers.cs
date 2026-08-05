using System.Text.Json;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace AWSPowerToolKit.Desktop.Bridge;

/// <summary>
/// Handlers .NET para el módulo S3, invocados desde el <see cref="BridgeRouter"/> (T4)
/// una vez que T10 los registre. Replica exactamente las operaciones de
/// <c>src/aws/s3Service.ts</c> (mismos nombres de campos, mismo <c>Delimiter: '/'</c> para
/// carpetas, mismo cap de <c>MAX_PREVIEW_BYTES</c> con flag <c>truncated</c>, mismo
/// copy+delete para renombrar, mismo copy in-place para cambiar storage class) para que el
/// frontend (T9, <c>src/bridge/s3Bridge.ts</c>) pueda envolver estas acciones con la misma
/// firma que ya expone <c>s3Service.ts</c>.
///
/// Cada método público tiene la firma <c>Task&lt;object&gt; (JsonElement payload)</c>, o sea
/// exactamente <c>Func&lt;JsonElement, Task&lt;object&gt;&gt;</c>, para que T10 pueda registrarlos
/// directamente sin wrapping adicional:
/// <code>
/// router.RegisterHandler("s3.listBuckets", s3Handlers.ListBuckets);
/// router.RegisterHandler("s3.listObjects", s3Handlers.ListObjects);
/// router.RegisterHandler("s3.getObjectMetadata", s3Handlers.GetObjectMetadata);
/// router.RegisterHandler("s3.getObjectContent", s3Handlers.GetObjectContent);
/// router.RegisterHandler("s3.deleteObject", s3Handlers.DeleteObject);
/// router.RegisterHandler("s3.renameObject", s3Handlers.RenameObject);
/// router.RegisterHandler("s3.setStorageClass", s3Handlers.SetStorageClass);
/// router.RegisterHandler("s3.restoreObject", s3Handlers.RestoreObject);
/// </code>
///
/// Todos los payloads incluyen <c>connectionId</c>, que se resuelve contra
/// <see cref="AccessStoreService.Load"/>-&gt;<c>S3Connections</c> (T5) para construir/cachear
/// un <see cref="AmazonS3Client"/> por conexión (mismo espíritu que <c>clientCache</c> en
/// <c>s3Client.ts</c>).
/// </summary>
public sealed class S3BridgeHandlers
{
    /// Mismo cap que `MAX_PREVIEW_BYTES` en `src/aws/s3Service.ts`.
    private const long MaxPreviewBytes = 1_000_000;

    private static readonly JsonSerializerOptions RequestJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AccessStoreService _accessStoreService;
    private readonly Dictionary<string, AmazonS3Client> _clientCache = new();

    public S3BridgeHandlers(AccessStoreService accessStoreService)
    {
        _accessStoreService = accessStoreService;
    }

    // ---- payload/result DTOs (mismo shape camelCase que el frontend) -----------------

    private sealed class BucketSummaryDto
    {
        public string Name { get; set; } = string.Empty;
        public string? CreationDate { get; set; }
    }

    private sealed class S3ObjectSummaryDto
    {
        public string Key { get; set; } = string.Empty;
        public long Size { get; set; }
        public string? LastModified { get; set; }
        public string? StorageClass { get; set; }
        public string? ETag { get; set; }
    }

    private sealed class ListObjectsResultDto
    {
        public List<S3ObjectSummaryDto> Objects { get; set; } = [];
        public List<string> CommonPrefixes { get; set; } = [];
        public bool IsTruncated { get; set; }
        public string? NextContinuationToken { get; set; }
    }

    private sealed class ObjectMetadataDto
    {
        public string Key { get; set; } = string.Empty;
        public long Size { get; set; }
        public string? ContentType { get; set; }
        public string? LastModified { get; set; }
        public string? StorageClass { get; set; }
        public string? ETag { get; set; }
        public Dictionary<string, string> Metadata { get; set; } = [];
        public string? RestoreStatus { get; set; }
    }

    private sealed class ObjectContentResultDto
    {
        public string Content { get; set; } = string.Empty;
        public bool Truncated { get; set; }
        public string? ContentType { get; set; }
    }

    private sealed class ListBucketsRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
    }

    private sealed class ListObjectsRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        public string? Prefix { get; set; }
        public string? ContinuationToken { get; set; }
    }

    private sealed class ObjectKeyRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
    }

    private sealed class RenameObjectRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        public string OldKey { get; set; } = string.Empty;
        public string NewKey { get; set; } = string.Empty;
    }

    private sealed class SetStorageClassRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
        public string StorageClass { get; set; } = string.Empty;
    }

    private sealed class RestoreObjectRequestDto
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
        public int? Days { get; set; }
    }

    // ---- action handlers ---------------------------------------------------------------

    public async Task<object> ListBuckets(JsonElement payload)
    {
        var request = Deserialize<ListBucketsRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        var response = await client.ListBucketsAsync();
        return (response.Buckets ?? [])
            .Select(b => new BucketSummaryDto
            {
                Name = b.BucketName ?? string.Empty,
                CreationDate = ToIsoString(b.CreationDate),
            })
            .ToList();
    }

    public async Task<object> ListObjects(JsonElement payload)
    {
        var request = Deserialize<ListObjectsRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        var response = await client.ListObjectsV2Async(new ListObjectsV2Request
        {
            BucketName = request.Bucket,
            Prefix = string.IsNullOrEmpty(request.Prefix) ? null : request.Prefix,
            Delimiter = "/",
            ContinuationToken = request.ContinuationToken,
        });

        var objects = (response.S3Objects ?? [])
            .Where(o => o.Key != request.Prefix)
            .Select(o => new S3ObjectSummaryDto
            {
                Key = o.Key ?? string.Empty,
                Size = o.Size,
                LastModified = ToIsoString(o.LastModified),
                StorageClass = o.StorageClass?.Value,
                ETag = o.ETag,
            })
            .ToList();

        var commonPrefixes = (response.CommonPrefixes ?? [])
            .Where(p => !string.IsNullOrEmpty(p))
            .ToList();

        return new ListObjectsResultDto
        {
            Objects = objects,
            CommonPrefixes = commonPrefixes,
            IsTruncated = response.IsTruncated,
            NextContinuationToken = response.NextContinuationToken,
        };
    }

    public async Task<object> GetObjectMetadata(JsonElement payload)
    {
        var request = Deserialize<ObjectKeyRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        var response = await client.GetObjectMetadataAsync(new GetObjectMetadataRequest
        {
            BucketName = request.Bucket,
            Key = request.Key,
        });

        var metadata = new Dictionary<string, string>();
        foreach (var metaKey in response.Metadata.Keys)
        {
            metadata[metaKey] = response.Metadata[metaKey];
        }

        return new ObjectMetadataDto
        {
            Key = request.Key,
            Size = response.ContentLength,
            ContentType = response.Headers.ContentType,
            LastModified = ToIsoString(response.LastModified),
            StorageClass = response.StorageClass?.Value,
            ETag = response.ETag,
            Metadata = metadata,
            RestoreStatus = response.Headers["x-amz-restore"],
        };
    }

    public async Task<object> GetObjectContent(JsonElement payload)
    {
        var request = Deserialize<ObjectKeyRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        using var response = await client.GetObjectAsync(new GetObjectRequest
        {
            BucketName = request.Bucket,
            Key = request.Key,
            ByteRange = new ByteRange(0, MaxPreviewBytes - 1),
        });

        using var reader = new StreamReader(response.ResponseStream);
        var content = await reader.ReadToEndAsync();

        var totalSize = ParseContentRangeTotal(response.ContentRange) ?? response.ContentLength;
        var truncated = totalSize > content.Length;

        return new ObjectContentResultDto
        {
            Content = content,
            Truncated = truncated,
            ContentType = response.Headers.ContentType,
        };
    }

    public async Task<object> DeleteObject(JsonElement payload)
    {
        var request = Deserialize<ObjectKeyRequestDto>(payload);
        var client = GetClient(request.ConnectionId);
        await client.DeleteObjectAsync(request.Bucket, request.Key);
        return new { ok = true };
    }

    /// S3 no tiene rename nativo; se implementa como copy a la key nueva + delete de la vieja.
    public async Task<object> RenameObject(JsonElement payload)
    {
        var request = Deserialize<RenameObjectRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        await client.CopyObjectAsync(new CopyObjectRequest
        {
            SourceBucket = request.Bucket,
            SourceKey = request.OldKey,
            DestinationBucket = request.Bucket,
            DestinationKey = request.NewKey,
        });
        await client.DeleteObjectAsync(request.Bucket, request.OldKey);
        return new { ok = true };
    }

    /// Cambia storage class vía copy in-place (mismo bucket/key) con `MetadataDirective: COPY`.
    public async Task<object> SetStorageClass(JsonElement payload)
    {
        var request = Deserialize<SetStorageClassRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        await client.CopyObjectAsync(new CopyObjectRequest
        {
            SourceBucket = request.Bucket,
            SourceKey = request.Key,
            DestinationBucket = request.Bucket,
            DestinationKey = request.Key,
            StorageClass = S3StorageClass.FindValue(request.StorageClass),
            MetadataDirective = S3MetadataDirective.COPY,
        });
        return new { ok = true };
    }

    /// Solicita una restauración temporal de un objeto archivado (Glacier/Deep Archive).
    public async Task<object> RestoreObject(JsonElement payload)
    {
        var request = Deserialize<RestoreObjectRequestDto>(payload);
        var client = GetClient(request.ConnectionId);

        await client.RestoreObjectAsync(new RestoreObjectRequest
        {
            BucketName = request.Bucket,
            Key = request.Key,
            Days = request.Days ?? 7,
        });
        return new { ok = true };
    }

    // ---- helpers ------------------------------------------------------------------------

    private static string? ToIsoString(DateTime value) =>
        value == default ? null : value.ToUniversalTime().ToString("o");

    /// Parsea el total de bytes del header `Content-Range` (`bytes 0-999999/TOTAL`), igual
    /// que `res.ContentRange.split('/')[1]` en `getObjectContent` de `s3Service.ts`.
    private static long? ParseContentRangeTotal(string? contentRange)
    {
        if (string.IsNullOrEmpty(contentRange)) return null;
        var parts = contentRange.Split('/');
        return parts.Length == 2 && long.TryParse(parts[1], out var total) ? total : null;
    }

    private static T Deserialize<T>(JsonElement payload)
    {
        return JsonSerializer.Deserialize<T>(payload, RequestJsonOptions)
            ?? throw new InvalidOperationException($"No se pudo deserializar el payload como {typeof(T).Name}.");
    }

    private AmazonS3Client GetClient(string connectionId)
    {
        if (string.IsNullOrEmpty(connectionId))
        {
            throw new InvalidOperationException("El payload no incluye 'connectionId'.");
        }

        var store = _accessStoreService.Load();
        var entry = store.S3Connections.FirstOrDefault(c => c.Id == connectionId)
            ?? throw new InvalidOperationException($"No se encontró ninguna conexión S3 con id '{connectionId}' en access.json.");

        var cacheKey = $"{entry.Id}:{entry.Region}:{entry.AccessKeyId}:{entry.SessionToken ?? string.Empty}";
        if (_clientCache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        AWSCredentials credentials = string.IsNullOrEmpty(entry.SessionToken)
            ? new BasicAWSCredentials(entry.AccessKeyId, entry.SecretAccessKey)
            : new SessionAWSCredentials(entry.AccessKeyId, entry.SecretAccessKey, entry.SessionToken);

        var client = new AmazonS3Client(credentials, Amazon.RegionEndpoint.GetBySystemName(entry.Region));
        _clientCache[cacheKey] = client;
        return client;
    }
}
