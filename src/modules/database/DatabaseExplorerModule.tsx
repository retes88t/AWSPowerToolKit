import { useState } from 'react'
import { Plug, AlertTriangle } from 'lucide-react'
import { useMongoConnectionsStore } from '../../store/mongoConnectionsStore'
import { useDatabaseExplorerStore } from '../../store/databaseExplorerStore'
import { ContainerSidebar } from '../../components/DatabaseExplorer/ContainerSidebar'
import { MongoConnectionManager } from '../../components/DatabaseExplorer/MongoConnectionManager'
import { QueryEditor } from '../../components/DatabaseExplorer/QueryEditor'
import { ResultsGrid } from '../../components/DatabaseExplorer/ResultsGrid'
import { Button } from '../../components/common/Button'

export function DatabaseExplorerModule() {
  const connections = useMongoConnectionsStore((s) => s.connections)
  const [showConnections, setShowConnections] = useState(connections.length === 0)

  const tabs = useDatabaseExplorerStore((s) => s.tabs)
  const activeTabKey = useDatabaseExplorerStore((s) => s.activeTabKey)
  const activeTab = tabs.find((t) => t.key === activeTabKey)
  const activeConnection = connections.find((c) => c.id === activeTab?.connectionId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h1 className="text-sm font-semibold">Database</h1>
        {connections.length === 0 && (
          <Button variant="primary" onClick={() => setShowConnections(true)}>
            <Plug size={14} />
            Conectar a Mongo
          </Button>
        )}
      </header>

      {!import.meta.env.DEV && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={14} className="shrink-0" />
          Este módulo depende de un proxy de solo-desarrollo para conectarse a Mongo/DocumentDB: en este sitio
          publicado no hay backend, así que no puede funcionar. Para uso real, cloná el repo y corré{' '}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">npm run dev</code>.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <ContainerSidebar onOpenConnections={() => setShowConnections(true)} />

        {activeTab && activeConnection ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <QueryEditor key={activeTab.key} tab={activeTab} connection={activeConnection} />
            <ResultsGrid documents={activeTab.documents} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Elegí una colección del panel izquierdo para empezar a correr queries.
          </div>
        )}
      </div>

      {showConnections && <MongoConnectionManager onClose={() => setShowConnections(false)} />}
    </div>
  )
}
