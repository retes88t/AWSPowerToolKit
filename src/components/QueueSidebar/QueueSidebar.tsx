import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search, Settings, AlertCircle } from 'lucide-react'
import { useConnectionsStore } from '../../store/connectionsStore'
import { useExplorerStore } from '../../store/explorerStore'
import { listQueues } from '../../aws/sqsService'
import { Button } from '../common/Button'
import type { QueueSummary } from '../../types/queue'

interface QueueSidebarProps {
  onOpenConnections: () => void
}

export function QueueSidebar({ onOpenConnections }: QueueSidebarProps) {
  const connections = useConnectionsStore((s) => s.connections)
  const activeConnectionId = useConnectionsStore((s) => s.activeConnectionId)
  const setActiveConnection = useConnectionsStore((s) => s.setActiveConnection)
  const activeConnection = connections.find((c) => c.id === activeConnectionId) ?? null

  const openQueueTab = useExplorerStore((s) => s.openQueueTab)
  const activeTabKey = useExplorerStore((s) => s.activeTabKey)

  const [search, setSearch] = useState('')

  const {
    data: queues,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['queues', activeConnection?.id],
    queryFn: () => listQueues(activeConnection!),
    enabled: !!activeConnection,
  })

  const filtered = useMemo(() => {
    if (!queues) return []
    if (!search.trim()) return queues
    const needle = search.toLowerCase()
    return queues.filter((q) => q.name.toLowerCase().includes(needle))
  }, [queues, search])

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
              placeholder="Filtrar colas..."
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
              <p className="p-3 text-xs text-gray-500 dark:text-gray-400">No se encontraron colas.</p>
            )}
            <ul>
              {filtered.map((q) => (
                <QueueRow
                  key={q.url}
                  queue={q}
                  isActive={activeTabKey === `${activeConnection.id}:${q.url}`}
                  onClick={() => openQueueTab(activeConnection.id, q)}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {!activeConnection && (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Elegí o creá una conexión para ver sus colas.
        </div>
      )}
    </aside>
  )
}

function QueueRow({ queue, isActive, onClick }: { queue: QueueSummary; isActive: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full truncate px-3 py-2 text-left text-sm ${
          isActive
            ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        }`}
        title={queue.name}
      >
        {queue.name}
        {queue.isFifo && <span className="ml-1.5 rounded bg-gray-200 px-1 text-[10px] dark:bg-gray-700">FIFO</span>}
      </button>
    </li>
  )
}
