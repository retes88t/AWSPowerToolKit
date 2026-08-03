export type FilterFieldKind = 'body' | 'messageId' | 'attribute'

export interface FilterField {
  kind: FilterFieldKind
  attributeName?: string
}

export type FilterOperator = 'contains' | 'notContains' | 'equals' | 'notEquals'

export interface AttributeFilterRule {
  id: string
  field: FilterField
  operator: FilterOperator
  value: string
}

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'contiene',
  notContains: 'no contiene',
  equals: 'es igual a',
  notEquals: 'no es igual a',
}
