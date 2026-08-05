import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Play, Wand2, AlertCircle } from 'lucide-react'
import { Button } from '../common/Button'
import { useDatabaseExplorerStore, type DatabaseTab } from '../../store/databaseExplorerStore'
import { runQuery } from '../../db/mongoService'
import type { MongoConnection } from '../../types/mongoConnection'
import { formatJson, highlightJson } from '../../utils/json'

interface QueryEditorProps {
  tab: DatabaseTab
  connection: MongoConnection
}

export function QueryEditor({ tab, connection }: QueryEditorProps) {
  const setFilter = useDatabaseExplorerStore((s) => s.setFilter)
  const setDocuments = useDatabaseExplorerStore((s) => s.setDocuments)
  const setLoading = useDatabaseExplorerStore((s) => s.setLoading)
  const setError = useDatabaseExplorerStore((s) => s.setError)

  const [limit, setLimit] = useState(50)
  const [formatError, setFormatError] = useState<string | null>(null)

  const parsedFilter = useMemo(() => {
    const trimmed = tab.filter.trim()
    if (!trimmed) return { value: undefined as Record<string, unknown> | undefined, valid: true }
    try {
      return { value: JSON.parse(trimmed) as Record<string, unknown>, valid: true }
    } catch {
      return { value: undefined, valid: false }
    }
  }, [tab.filter])

  const runMutation = useMutation({
    mutationFn: () => {
      if (!parsedFilter.valid) {
        throw new Error('El filtro no es un JSON válido')
      }
      setLoading(tab.key, true)
      setError(tab.key, null)
      return runQuery(connection, tab.database, tab.collection, parsedFilter.value, { limit })
    },
    onSuccess: (documents) => {
      setDocuments(tab.key, documents)
      setLoading(tab.key, false)
    },
    onError: (err: Error) => {
      setError(tab.key, err.message)
      setLoading(tab.key, false)
    },
  })

  function handleFormat() {
    try {
      setFilter(tab.key, formatJson(tab.filter.trim() || '{}'))
      setFormatError(null)
    } catch {
      setFormatError('El filtro no es un JSON válido, no se pudo formatear')
    }
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <h4 className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
          Filtro (find) — {tab.database}.{tab.collection}
        </h4>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
            Límite
            <input
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-16 rounded-md border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <Button variant="ghost" onClick={handleFormat} className="text-xs">
            <Wand2 size={12} />
            Formatear
          </Button>
          <Button variant="primary" onClick={() => runMutation.mutate()} disabled={tab.isLoading}>
            <Play size={14} />
            {tab.isLoading ? 'Ejecutando…' : 'Ejecutar query'}
          </Button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <textarea
          value={tab.filter}
          onChange={(e) => setFilter(tab.key, e.target.value)}
          spellCheck={false}
          rows={4}
          placeholder='{ "campo": "valor" }'
          className="w-full resize-y rounded-md border border-gray-300 bg-gray-50 p-2 font-mono text-xs outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        {tab.filter.trim() && parsedFilter.valid && (
          <pre
            className="mt-1 max-h-24 overflow-auto rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-900"
            dangerouslySetInnerHTML={{ __html: highlightJson(safeFormat(tab.filter)) }}
          />
        )}

        {!parsedFilter.valid && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">El filtro no es un JSON válido</p>
        )}

        {(formatError || tab.lastError) && (
          <div className="mt-1 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{formatError ?? tab.lastError}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function safeFormat(text: string): string {
  try {
    return formatJson(text)
  } catch {
    return text
  }
}
