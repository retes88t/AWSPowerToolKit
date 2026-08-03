export interface SqsMessageAttributeVM {
  name: string
  type: string
  value: string
}

export interface SqsMessageVM {
  messageId: string
  receiptHandle: string
  body: string
  attributes: SqsMessageAttributeVM[]
  systemAttributes: Record<string, string>
  receivedAt: number
}
