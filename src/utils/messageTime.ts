import type { SqsMessageVM } from '../types/message'

export function getMessageTimestamp(message: SqsMessageVM): number {
  const sent = Number(message.systemAttributes.SentTimestamp)
  return Number.isFinite(sent) && sent > 0 ? sent : message.receivedAt
}

export function formatMessageTimestamp(message: SqsMessageVM): string {
  return new Date(getMessageTimestamp(message)).toLocaleString()
}
