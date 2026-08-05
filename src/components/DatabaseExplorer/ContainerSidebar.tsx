import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search, Settings, AlertCircle, ChevronRight, ChevronDown, Database as DatabaseIcon } from 'lucide-react'
import { useMongoConnectionsStore } from '../../store/mongoConnectionsStore'
import { useDatabaseExplorerStore, databaseTabKey } from '../../store/databaseExplorerStore'
import { listDatabases, listCollections } from '../../db/mongoService'
import { Button } from '../common/Button'
import type { MongoConnection } from '../../types/mongoConnection'

interface ContainerSidebarProps {
  onOpenConnections: () => void
}

export function ContainerSidebar({ onOpenConnections }: ContainerSidebarProps) {
  const connections = useMongoConnectionsStore((s) => s.connections)
  const activeConnectionId = useMongoConnectionsStore((s) => s.activeConnectionId)
  const setActiveConnection = useMongoConnectionsStore((s) => s.setActiveConnection)
  const activeConnection = connections.find((c) => c.id === activeConnectionId) ?? null

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const {
    data: databases,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['mongo-databases', activeConnection?.id],
    queryFn: () => listDatabases(activeConnection!),
    enabled: !!activeConnection,
  })

  const filteredDatabases = useMemo(() => {
    if (!databases) return []
    if (!search.trim()) return databases
    const needle = search.toLowerCase()
    return databases.filter((db) => db.toLowerCase().includes(needle))
  }, [databases, search])

  function toggleExpanded(db: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(db)) next.delete(db)
      else next.add(db)
      return next
    })
  }

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
              placeholder="Filtrar bases..."
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
            {!isError && filteredDatabases.length === 0 && !isFetching && (
              <p className="p-3 text-xs text-gray-500 dark:text-gray-400">No se encontraron bases de datos.</p>
            )}
            <ul>
              {filteredDatabases.map((db) => (
                <DatabaseNode
                  key={db}
                  connection={activeConnection}
                  database={db}
                  isExpanded={expanded.has(db)}
                  search={search}
                  onToggle={() => toggleExpanded(db)}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {!activeConnection && (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Elegí o creá una conexión para ver sus bases de datos.
        </div>
      )}
    </aside>
  )
}

function DatabaseNode({
  connection,
  database,
  isExpanded,
  search,
  onToggle,
}: {
  connection: MongoConnection
  database: string
  isExpanded: boolean
  search: string
  onToggle: () => void
}) {
  const openCollectionTab = useDatabaseExplorerStore((s) => s.openCollectionTab)
  const activeTabKey = useDatabaseExplorerStore((s) => s.activeTabKey)

  const {
    data: collections,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['mongo-collections', connection.id, database],
    queryFn: () => listCollections(connection, database),
    enabled: isExpanded,
  })

  const filteredCollections = useMemo(() => {
    if (!collections) return []
    if (!search.trim()) return collections
    const needle = search.toLowerCase()
    return collections.filter((c) => c.toLowerCase().includes(needle))
  }, [collections, search])

  return (
    <li>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
        <DatabaseIcon size={14} className="shrink-0 text-gray-400" />
        <span className="truncate" title={database}>
          {database}
        </span>
      </button>

      {isExpanded && (
        <ul className="pl-6">
          {isFetching && <li className="px-3 py-1 text-xs text-gray-400">Cargando...</li>}
          {isError && (
            <li className="px-3 py-1 text-xs text-red-600 dark:text-red-400">{(error as Error).message}</li>
          )}
          {!isFetching && !isError && filteredCollections.length === 0 && (
            <li className="px-3 py-1 text-xs text-gray-400">Sin colecciones.</li>
          )}
          {filteredCollections.map((col) => {
            const key = databaseTabKey(connection.id, database, col)
            const isActive = activeTabKey === key
            return (
              <li key={col}>
                <button
                  onClick={() => openCollectionTab(connection.id, database, col)}
                  className={`w-full truncate px-3 py-1.5 text-left text-sm ${
                    isActive
                      ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                  title={col}
                >
                  {col}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
