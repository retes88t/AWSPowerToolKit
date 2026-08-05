import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { highlightJson } from '../../utils/json'

interface ResultsGridProps {
  documents: unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Best-effort human-readable `_id`, handling plain values and serialized ObjectId shapes (`{ $oid: '...' }`). */
function stringifyId(doc: unknown, index: number): string {
  if (!isRecord(doc) || !('_id' in doc)) return String(index)
  const id = doc._id
  if (typeof id === 'string' || typeof id === 'number') return String(id)
  if (isRecord(id) && typeof id.$oid === 'string') return id.$oid
  try {
    return JSON.stringify(id)
  } catch {
    return String(index)
  }
}

function previewDoc(doc: unknown, max = 160): string {
  let text: string
  try {
    text = JSON.stringify(doc)
  } catch {
    text = String(doc)
  }
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function ResultsGrid({ documents }: ResultsGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const selectedDoc = selectedIndex !== null ? documents[selectedIndex] : undefined

  const selectedJson = useMemo(() => {
    if (selectedDoc === undefined) return null
    try {
      return { text: JSON.stringify(selectedDoc, null, 2), valid: true }
    } catch {
      return { text: String(selectedDoc), valid: false }
    }
  }, [selectedDoc])

  if (documents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No hay resultados. Ejecutá una query para ver documentos.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">#</th>
              <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">_id</th>
              <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Documento</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, index) => (
              <tr
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 ${
                  index === selectedIndex
                    ? 'bg-indigo-50 dark:bg-indigo-950'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{index + 1}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {stringifyId(doc, index)}
                </td>
                <td className="max-w-xl truncate px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                  {previewDoc(doc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDoc !== undefined && (
        <div className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalle del documento</h3>
            <button
              onClick={() => setSelectedIndex(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedJson?.valid ? (
              <pre
                className="max-h-full overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800"
                dangerouslySetInnerHTML={{ __html: highlightJson(selectedJson.text) }}
              />
            ) : (
              <pre className="max-h-full overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-100 p-2 text-xs text-gray-100 dark:bg-gray-800">
                {selectedJson?.text}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
