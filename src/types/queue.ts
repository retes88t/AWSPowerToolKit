export interface QueueSummary {
  url: string
  name: string
  isFifo: boolean
  approxMessages?: number
  approxMessagesNotVisible?: number
  approxMessagesDelayed?: number
  deadLetterTargetArn?: string
}
