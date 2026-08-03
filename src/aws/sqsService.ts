import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  SendMessageCommand,
  PurgeQueueCommand,
  type MessageAttributeValue,
} from '@aws-sdk/client-sqs'
import { createSqsClient } from './sqsClient'
import type { AwsConnection } from '../types/connection'
import type { QueueSummary } from '../types/queue'
import type { SqsMessageVM } from '../types/message'

const clientCache = new Map<string, SQSClient>()

function clientCacheKey(connection: AwsConnection): string {
  return `${connection.id}:${connection.region}:${connection.accessKeyId}:${connection.sessionToken ?? ''}`
}

function getClient(connection: AwsConnection): SQSClient {
  const cacheKey = clientCacheKey(connection)
  let client = clientCache.get(cacheKey)
  if (!client) {
    client = createSqsClient(connection)
    clientCache.set(cacheKey, client)
  }
  return client
}

function queueNameFromUrl(url: string): string {
  const parts = url.split('/')
  return parts[parts.length - 1] ?? url
}

export async function listQueues(connection: AwsConnection, prefix?: string): Promise<QueueSummary[]> {
  const client = getClient(connection)
  const urls: string[] = []
  let nextToken: string | undefined

  do {
    const res = await client.send(
      new ListQueuesCommand({
        QueueNamePrefix: prefix || undefined,
        NextToken: nextToken,
        MaxResults: 1000,
      }),
    )
    urls.push(...(res.QueueUrls ?? []))
    nextToken = res.NextToken
  } while (nextToken)

  return urls.map((url) => ({
    url,
    name: queueNameFromUrl(url),
    isFifo: url.endsWith('.fifo'),
  }))
}

const QUEUE_ATTRIBUTE_NAMES = [
  'ApproximateNumberOfMessages',
  'ApproximateNumberOfMessagesNotVisible',
  'ApproximateNumberOfMessagesDelayed',
  'RedrivePolicy',
] as const

export async function getQueueSummary(connection: AwsConnection, queue: QueueSummary): Promise<QueueSummary> {
  const client = getClient(connection)
  const res = await client.send(
    new GetQueueAttributesCommand({ QueueUrl: queue.url, AttributeNames: [...QUEUE_ATTRIBUTE_NAMES] }),
  )
  const attrs = res.Attributes ?? {}

  let deadLetterTargetArn: string | undefined
  if (attrs.RedrivePolicy) {
    try {
      deadLetterTargetArn = JSON.parse(attrs.RedrivePolicy).deadLetterTargetArn
    } catch {
      deadLetterTargetArn = undefined
    }
  }

  return {
    ...queue,
    approxMessages: attrs.ApproximateNumberOfMessages ? Number(attrs.ApproximateNumberOfMessages) : undefined,
    approxMessagesNotVisible: attrs.ApproximateNumberOfMessagesNotVisible
      ? Number(attrs.ApproximateNumberOfMessagesNotVisible)
      : undefined,
    approxMessagesDelayed: attrs.ApproximateNumberOfMessagesDelayed
      ? Number(attrs.ApproximateNumberOfMessagesDelayed)
      : undefined,
    deadLetterTargetArn,
  }
}

export interface ReceiveOptions {
  maxMessages: number
  visibilityTimeoutSeconds: number
  waitTimeSeconds: number
  releaseAfterReceive: boolean
}

export async function receiveMessages(
  connection: AwsConnection,
  queue: QueueSummary,
  options: ReceiveOptions,
): Promise<SqsMessageVM[]> {
  const client = getClient(connection)
  const collected: SqsMessageVM[] = []
  const seen = new Set<string>()
  let remaining = options.maxMessages

  while (remaining > 0) {
    const batchSize = Math.min(10, remaining)
    const res = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queue.url,
        MaxNumberOfMessages: batchSize,
        VisibilityTimeout: options.visibilityTimeoutSeconds,
        WaitTimeSeconds: Math.min(options.waitTimeSeconds, 20),
        MessageAttributeNames: ['All'],
        MessageSystemAttributeNames: ['All'],
      }),
    )
    const messages = res.Messages ?? []
    if (messages.length === 0) break

    for (const m of messages) {
      if (!m.MessageId || seen.has(m.MessageId)) continue
      seen.add(m.MessageId)

      collected.push({
        messageId: m.MessageId,
        receiptHandle: m.ReceiptHandle ?? '',
        body: m.Body ?? '',
        attributes: Object.entries(m.MessageAttributes ?? {}).map(([name, attr]) => ({
          name,
          type: attr.DataType ?? 'String',
          value: attr.StringValue ?? '',
        })),
        systemAttributes: (m.Attributes ?? {}) as Record<string, string>,
        receivedAt: Date.now(),
      })

      if (options.releaseAfterReceive && m.ReceiptHandle) {
        await client.send(
          new ChangeMessageVisibilityCommand({
            QueueUrl: queue.url,
            ReceiptHandle: m.ReceiptHandle,
            VisibilityTimeout: 0,
          }),
        )
      }
    }

    remaining -= messages.length
    if (messages.length < batchSize) break
  }

  return collected
}

export async function deleteMessage(connection: AwsConnection, queue: QueueSummary, receiptHandle: string) {
  const client = getClient(connection)
  await client.send(new DeleteMessageCommand({ QueueUrl: queue.url, ReceiptHandle: receiptHandle }))
}

export async function releaseMessage(connection: AwsConnection, queue: QueueSummary, receiptHandle: string) {
  const client = getClient(connection)
  await client.send(
    new ChangeMessageVisibilityCommand({ QueueUrl: queue.url, ReceiptHandle: receiptHandle, VisibilityTimeout: 0 }),
  )
}

export async function purgeQueue(connection: AwsConnection, queue: QueueSummary) {
  const client = getClient(connection)
  await client.send(new PurgeQueueCommand({ QueueUrl: queue.url }))
}

export interface SendMessageInput {
  body: string
  attributes: { name: string; type: string; value: string }[]
  delaySeconds?: number
  messageGroupId?: string
  messageDeduplicationId?: string
}

export async function sendMessage(connection: AwsConnection, queue: QueueSummary, input: SendMessageInput) {
  const client = getClient(connection)
  const messageAttributes: Record<string, MessageAttributeValue> = {}
  for (const attr of input.attributes) {
    if (!attr.name) continue
    messageAttributes[attr.name] = { DataType: attr.type || 'String', StringValue: attr.value }
  }

  await client.send(
    new SendMessageCommand({
      QueueUrl: queue.url,
      MessageBody: input.body,
      DelaySeconds: queue.isFifo ? undefined : input.delaySeconds,
      MessageAttributes: Object.keys(messageAttributes).length ? messageAttributes : undefined,
      MessageGroupId: queue.isFifo ? input.messageGroupId || undefined : undefined,
      MessageDeduplicationId: queue.isFifo ? input.messageDeduplicationId || undefined : undefined,
    }),
  )
}
