import type { AttributeFilterRule } from '../types/filter'
import type { SqsMessageVM } from '../types/message'

function fieldValue(message: SqsMessageVM, rule: AttributeFilterRule): string | undefined {
  switch (rule.field.kind) {
    case 'body':
      return message.body
    case 'messageId':
      return message.messageId
    case 'attribute': {
      const attr = message.attributes.find((a) => a.name === rule.field.attributeName)
      return attr?.value
    }
    default:
      return undefined
  }
}

function matchesRule(message: SqsMessageVM, rule: AttributeFilterRule): boolean {
  const value = fieldValue(message, rule)
  const needle = rule.value

  switch (rule.operator) {
    case 'contains':
      return value !== undefined && value.includes(needle)
    case 'notContains':
      return value === undefined || !value.includes(needle)
    case 'equals':
      return value === needle
    case 'notEquals':
      return value !== needle
    default:
      return true
  }
}

export function filterMessages(messages: SqsMessageVM[], rules: AttributeFilterRule[]): SqsMessageVM[] {
  if (rules.length === 0) return messages
  return messages.filter((message) => rules.every((rule) => matchesRule(message, rule)))
}
