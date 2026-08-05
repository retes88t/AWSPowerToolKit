import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, AlertCircle } from 'lucide-react'
import { getObjectContent, getObjectMetadata } from '../../aws/s3Service'
import type { S3Connection } from '../../types/s3Connection'
import { formatJson, highlightJson } from '../../utils/json'
import { ObjectActionsMenu } from './ObjectActionsMenu'

interface ObjectDetailDrawerProps {
  connection: S3Connection
  bucket: string
  objectKey: string
  onClose: () => void
  onDeleted: () => void
  onRenamed: (newKey: string) => void
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex++
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

/** Text-ish content types worth previewing inline; anything else just shows metadata. */
function isPreviewable(contentType?: string): boolean {
  if (!contentType) return true
  return /^text\/|json|xml|javascript|yaml/.test(contentType)
}

export function ObjectDetailDrawer({ connection, bucket, objectKey, onClose, onDeleted, onRenamed }: ObjectDetailDrawerProps) {
  const [currentKey, setCurrentKey] = useState(objectKey)

  const metadataQuery = useQuery({
    queryKey: ['s3-object-metadata', connection.id, bucket, currentKey],
    queryFn: () => getObjectMetadata(connection, bucket, currentKey),
  })

  const previewable = isPreviewable(metadataQuery.data?.contentType)

  const contentQuery = useQuery({
    queryKey: ['s3-object-content', connection.id, bucket, currentKey],
    queryFn: () => getObjectContent(connection, bucket, currentKey),
    enabled: metadataQuery.isSuccess && previewable,
  })

  const jsonPreview = useMemo(() => {
    if (!contentQuery.data) return null
    try {
      return { text: formatJson(contentQuery.data.content), valid: true }
    } catch {
      return { text: contentQuery.data.content, valid: false }
    }
  }, [contentQuery.data])

  return (
    <div className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={currentKey}>
          {currentKey}
        </h3>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {metadataQuery.isError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{(metadataQuery.error as Error).message}</span>
          </div>
        )}

        {metadataQuery.data && (
          <Section title="Metadata">
            <AttributeTable
              rows={[
                ['Tamaño', formatBytes(metadataQuery.data.size)],
                ['Content-Type', metadataQuery.data.contentType ?? '—'],
                ['Última modificación', metadataQuery.data.lastModified ?? '—'],
                ['Storage class', metadataQuery.data.storageClass ?? 'STANDARD'],
                ['ETag', metadataQuery.data.eTag ?? '—'],
                ['Estado de restore', metadataQuery.data.restoreStatus ?? '—'],
              ]}
            />
          </Section>
        )}

        {metadataQuery.data?.metadata && Object.keys(metadataQuery.data.metadata).length > 0 && (
          <Section title="Metadata custom">
            <AttributeTable rows={Object.entries(metadataQuery.data.metadata)} />
          </Section>
        )}

        <Section title="Contenido">
          {!previewable && <p className="text-xs text-gray-400">Vista previa no disponible para este tipo de contenido.</p>}
          {previewable && contentQuery.isLoading && <p className="text-xs text-gray-400">Cargando contenido…</p>}
          {previewable && contentQuery.isError && (
            <p className="text-xs text-red-600 dark:text-red-400">{(contentQuery.error as Error).message}</p>
          )}
          {previewable && contentQuery.data && jsonPreview && (
            <>
              {jsonPreview.valid ? (
                <pre
                  className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800"
                  dangerouslySetInnerHTML={{ __html: highlightJson(jsonPreview.text) }}
                />
              ) : (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800 dark:text-gray-100">
                  {jsonPreview.text}
                </pre>
              )}
              {contentQuery.data.truncated && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Contenido truncado por tamaño, se muestra solo una parte del objeto.
                </p>
              )}
            </>
          )}
        </Section>
      </div>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <ObjectActionsMenu
          connection={connection}
          bucket={bucket}
          objectKey={currentKey}
          currentStorageClass={metadataQuery.data?.storageClass}
          onDeleted={onDeleted}
          onRenamed={(newKey) => {
            setCurrentKey(newKey)
            onRenamed(newKey)
          }}
          onStorageClassChanged={() => metadataQuery.refetch()}
          onRestored={() => metadataQuery.refetch()}
        />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{title}</h4>
      {children}
    </div>
  )
}

function AttributeTable({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([key, value]) => (
          <tr key={key} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
            <td className="py-1 pr-2 font-medium text-gray-500 dark:text-gray-400">{key}</td>
            <td className="break-all py-1 font-mono text-gray-800 dark:text-gray-200">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
