import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { RefreshCw, Search, Folder, File as FileIcon, AlertCircle, ChevronRight } from 'lucide-react'
import { useS3ExplorerStore, type BucketTab, type S3ObjectSummary } from '../../store/s3ExplorerStore'
import { listObjects } from '../../aws/s3Service'
import type { S3Connection } from '../../types/s3Connection'
import { Button } from '../common/Button'

interface ObjectBrowserProps {
  tab: BucketTab
  connection: S3Connection
  selectedKey: string | null
  onSelect: (object: S3ObjectSummary) => void
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

function basename(key: string): string {
  const trimmed = key.endsWith('/') ? key.slice(0, -1) : key
  const idx = trimmed.lastIndexOf('/')
  return idx === -1 ? trimmed : trimmed.slice(idx + 1)
}

export function ObjectBrowser({ tab, connection, selectedKey, onSelect }: ObjectBrowserProps) {
  const setPrefix = useS3ExplorerStore((s) => s.setPrefix)
  const setObjects = useS3ExplorerStore((s) => s.setObjects)
  const setSearchFilter = useS3ExplorerStore((s) => s.setSearchFilter)
  const setLoading = useS3ExplorerStore((s) => s.setLoading)
  const setError = useS3ExplorerStore((s) => s.setError)

  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined)
  const [isTruncated, setIsTruncated] = useState(false)

  const listMutation = useMutation({
    mutationFn: (token: string | undefined) => {
      setLoading(tab.key, true)
      setError(tab.key, null)
      return listObjects(connection, tab.bucket, tab.currentPrefix, token)
    },
    onSuccess: (result, token) => {
      const folders: S3ObjectSummary[] = result.commonPrefixes.map((p) => ({ key: p, isFolder: true }))
      const files: S3ObjectSummary[] = result.objects.map((o) => ({
        key: o.key,
        isFolder: false,
        size: o.size,
        lastModified: o.lastModified,
        storageClass: o.storageClass,
        eTag: o.eTag,
      }))
      const combined = [...folders, ...files]
      setObjects(tab.key, token ? [...tab.objects, ...combined] : combined)
      setIsTruncated(result.isTruncated)
      setContinuationToken(result.nextContinuationToken)
      setLoading(tab.key, false)
    },
    onError: (err: Error) => {
      setError(tab.key, err.message)
      setLoading(tab.key, false)
    },
  })

  useEffect(() => {
    setContinuationToken(undefined)
    setIsTruncated(false)
    listMutation.mutate(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.key, tab.currentPrefix])

  const breadcrumbSegments = useMemo(() => {
    const parts = tab.currentPrefix.split('/').filter(Boolean)
    return parts.map((part, idx) => ({
      label: part,
      prefix: `${parts.slice(0, idx + 1).join('/')}/`,
    }))
  }, [tab.currentPrefix])

  const filtered = useMemo(() => {
    if (!tab.searchFilter.trim()) return tab.objects
    const needle = tab.searchFilter.toLowerCase()
    return tab.objects.filter((o) => basename(o.key).toLowerCase().includes(needle))
  }, [tab.objects, tab.searchFilter])

  function openFolder(prefix: string) {
    setPrefix(tab.key, prefix)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <button className="hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => openFolder('')}>
            {tab.bucket}
          </button>
          {breadcrumbSegments.map((seg) => (
            <span key={seg.prefix} className="flex items-center gap-1">
              <ChevronRight size={12} />
              <button className="hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => openFolder(seg.prefix)}>
                {seg.label}
              </button>
            </span>
          ))}
        </div>
        <button
          onClick={() => {
            setContinuationToken(undefined)
            setIsTruncated(false)
            listMutation.mutate(undefined)
          }}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Refrescar"
        >
          <RefreshCw size={14} className={tab.isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <Search size={14} className="text-gray-400" />
        <input
          value={tab.searchFilter}
          onChange={(e) => setSearchFilter(tab.key, e.target.value)}
          placeholder="Filtrar por nombre..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-gray-100"
        />
      </div>

      {tab.lastError && (
        <div className="mx-3 mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{tab.lastError}</span>
        </div>
      )}

      {filtered.length === 0 && !tab.isLoading && (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          No hay objetos en esta ubicación.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Nombre</th>
                <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Tamaño</th>
                <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Storage class</th>
                <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Última modificación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.key}
                  onClick={() => (o.isFolder ? openFolder(o.key) : onSelect(o))}
                  className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 ${
                    !o.isFolder && o.key === selectedKey
                      ? 'bg-indigo-50 dark:bg-indigo-950'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <td className="max-w-md truncate px-3 py-2 text-xs text-gray-800 dark:text-gray-200">
                    <span className="inline-flex items-center gap-1.5">
                      {o.isFolder ? (
                        <Folder size={14} className="shrink-0 text-amber-500" />
                      ) : (
                        <FileIcon size={14} className="shrink-0 text-gray-400" />
                      )}
                      {basename(o.key)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{formatBytes(o.size)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{o.storageClass ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {o.lastModified ? new Date(o.lastModified).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isTruncated && (
        <div className="flex justify-center border-t border-gray-200 p-2 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={() => listMutation.mutate(continuationToken)}
            disabled={listMutation.isPending}
          >
            {listMutation.isPending ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  )
}
