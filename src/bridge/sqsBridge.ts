// Typed wrappers around the desktop message bridge (see desktopBridge.ts) for
// the SQS domain. Each export mirrors the signature of its counterpart in
// `src/aws/sqsService.ts` so that consuming it from the store/service layer
// (a later task) is a drop-in swap once `isDesktopBridgeAvailable()` is true.
//
// The .NET side (`SqsBridgeHandlers`, desktop/AWSPowerToolKit.Desktop/Bridge/SqsBridgeHandlers.cs)
// resolves AWS credentials by `connectionId` against `AccessStoreService`
// (access.json) instead of receiving them on every call, so payloads carry
// `connectionId` rather than the full `AwsConnection`.
//
// Actions exposed by the .NET router (see workplan T6):
//   sqs.listQueues, sqs.getQueueSummary, sqs.receiveMessages,
//   sqs.deleteMessage, sqs.releaseMessage, sqs.purgeQueue, sqs.sendMessage

import { callBridge } from './desktopBridge'
import type { AwsConnection } from '../types/connection'
import type { QueueSummary } from '../types/queue'
import type { SqsMessageVM } from '../types/message'
import type { ReceiveOptions, SendMessageInput } from '../aws/sqsService'

export async function listQueues(connection: AwsConnection, prefix?: string): Promise<QueueSummary[]> {
  return callBridge('sqs.listQueues', { connectionId: connection.id, prefix })
}

export async function getQueueSummary(connection: AwsConnection, queue: QueueSummary): Promise<QueueSummary> {
  return callBridge('sqs.getQueueSummary', { connectionId: connection.id, queue })
}

export async function receiveMessages(
  connection: AwsConnection,
  queue: QueueSummary,
  options: ReceiveOptions,
): Promise<SqsMessageVM[]> {
  return callBridge('sqs.receiveMessages', { connectionId: connection.id, queue, options })
}

export async function deleteMessage(
  connection: AwsConnection,
  queue: QueueSummary,
  receiptHandle: string,
): Promise<void> {
  await callBridge('sqs.deleteMessage', { connectionId: connection.id, queue, receiptHandle })
}

export async function releaseMessage(
  connection: AwsConnection,
  queue: QueueSummary,
  receiptHandle: string,
): Promise<void> {
  await callBridge('sqs.releaseMessage', { connectionId: connection.id, queue, receiptHandle })
}

export async function purgeQueue(connection: AwsConnection, queue: QueueSummary): Promise<void> {
  await callBridge('sqs.purgeQueue', { connectionId: connection.id, queue })
}

export async function sendMessage(
  connection: AwsConnection,
  queue: QueueSummary,
  input: SendMessageInput,
): Promise<void> {
  await callBridge('sqs.sendMessage', { connectionId: connection.id, queue, input })
}
