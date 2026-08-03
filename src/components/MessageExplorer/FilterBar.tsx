import { Plus, X } from 'lucide-react'
import { Button } from '../common/Button'
import {
  FILTER_OPERATOR_LABELS,
  type AttributeFilterRule,
  type FilterFieldKind,
  type FilterOperator,
} from '../../types/filter'

interface FilterBarProps {
  filters: AttributeFilterRule[]
  onChange: (filters: AttributeFilterRule[]) => void
}

const FIELD_LABELS: Record<FilterFieldKind, string> = {
  body: 'Body',
  messageId: 'MessageId',
  attribute: 'Atributo',
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function addFilter() {
    onChange([...filters, { id: crypto.randomUUID(), field: { kind: 'body' }, operator: 'contains', value: '' }])
  }

  function updateFilter(id: string, patch: Partial<AttributeFilterRule>) {
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function removeFilter(id: string) {
    onChange(filters.filter((f) => f.id !== id))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      {filters.length === 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500">Sin filtros — se muestran todos los mensajes traídos.</span>
      )}

      {filters.map((filter) => (
        <div
          key={filter.id}
          className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-1.5 py-1 dark:border-gray-600 dark:bg-gray-800"
        >
          <select
            className="bg-transparent text-xs outline-none dark:text-gray-100"
            value={filter.field.kind}
            onChange={(e) =>
              updateFilter(filter.id, {
                field: { kind: e.target.value as FilterFieldKind, attributeName: filter.field.attributeName },
              })
            }
          >
            {Object.entries(FIELD_LABELS).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>

          {filter.field.kind === 'attribute' && (
            <input
              className="w-24 border-l border-gray-200 bg-transparent px-1 text-xs outline-none dark:border-gray-600 dark:text-gray-100"
              placeholder="nombre"
              value={filter.field.attributeName ?? ''}
              onChange={(e) =>
                updateFilter(filter.id, { field: { kind: 'attribute', attributeName: e.target.value } })
              }
            />
          )}

          <select
            className="border-l border-gray-200 bg-transparent px-1 text-xs outline-none dark:border-gray-600 dark:text-gray-100"
            value={filter.operator}
            onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
          >
            {Object.entries(FILTER_OPERATOR_LABELS).map(([op, label]) => (
              <option key={op} value={op}>
                {label}
              </option>
            ))}
          </select>

          <input
            className="w-28 border-l border-gray-200 bg-transparent px-1 text-xs outline-none dark:border-gray-600 dark:text-gray-100"
            placeholder="valor"
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          />

          <button
            onClick={() => removeFilter(filter.id)}
            className="text-gray-400 hover:text-red-500"
            aria-label="Quitar filtro"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <Button variant="ghost" onClick={addFilter} className="text-xs">
        <Plus size={12} />
        Filtro
      </Button>
    </div>
  )
}
