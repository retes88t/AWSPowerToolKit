import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search, Settings, AlertCircle } from 'lucide-react'
import { useS3ConnectionsStore } from '../../store/s3ConnectionsStore'
import { useS3ExplorerStore, bucketTabKey } from '../../store/s3ExplorerStore'
import { listBuckets, type BucketSummary } from '../../aws/s3Service'
import { Button } from '../common/Button'

interface BucketSidebarProps {
  onOpenConnections: () => void
}

export function BucketSidebar({ onOpenConnections }: BucketSidebarProps) {
  const connections = useS3ConnectionsStore((s) => s.connections)
  const activeConnectionId = useS3ConnectionsStore((s) => s.activeConnectionId)
  const setActiveConnection = useS3ConnectionsStore((s) => s.setActiveConnection)
  const activeConnection = connections.find((c) => c.id === activeConnectionId) ?? null

  const openBucketTab = useS3ExplorerStore((s) => s.openBucketTab)
  const activeTabKey = useS3ExplorerStore((s) => s.activeTabKey)

  const [search, setSearch] = useState('')

  const {
    data: buckets,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['s3-buckets', activeConnection?.id],
    queryFn: () => listBuckets(activeConnection!),
    enabled: !!activeConnection,
  })

  const filtered = useMemo(() => {
    if (!buckets) return []
    if (!search.trim()) return buckets
    const needle = search.toLowerCase()
    return buckets.filter((b) => b.name.toLowerCase().includes(needle))
  }, [buckets, search])

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <select
          className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-gray-900 outline-none dark:text-gray-100"
          value={activeConnectionId ?? ''}
          onChange={(e) => setActiveConnection(e.target.value || null)}
        >
          <option value="" disabled>
            Elegí una conexión
          </option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button variant="ghost" onClick={onOpenConnections} aria-label="Conexiones">
          <Settings size={16} />
        </Button>
      </div>

      {activeConnection && (
        <>
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar buckets..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-gray-100"
            />
            <button
              onClick={() => refetch()}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Refrescar"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isError && (
              <div className="m-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{(error as Error).message}</span>
              </div>
            )}
            {!isError && filtered.length === 0 && !isFetching && (
              <p className="p-3 text-xs text-gray-500 dark:text-gray-400">No se encontraron buckets.</p>
            )}
            <ul>
              {filtered.map((b) => (
                <BucketRow
                  key={b.name}
                  bucket={b}
                  isActive={activeTabKey === bucketTabKey(activeConnection.id, b.name)}
                  onClick={() => openBucketTab(activeConnection.id, b.name)}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {!activeConnection && (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Elegí o creá una conexión para ver sus buckets.
        </div>
      )}
    </aside>
  )
}

function BucketRow({
  bucket,
  isActive,
  onClick,
}: {
  bucket: BucketSummary
  isActive: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full truncate px-3 py-2 text-left text-sm ${
          isActive
            ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        }`}
        title={bucket.name}
      >
        {bucket.name}
      </button>
    </li>
  )
}
