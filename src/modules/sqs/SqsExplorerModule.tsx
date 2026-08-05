import { useState } from 'react'
import { Plug, AlertTriangle } from 'lucide-react'
import { useConnectionsStore } from '../../store/connectionsStore'
import { QueueSidebar } from '../../components/QueueSidebar/QueueSidebar'
import { MessageExplorer } from '../../components/MessageExplorer/MessageExplorer'
import { ConnectionManager } from '../../components/ConnectionManager/ConnectionManager'
import { Button } from '../../components/common/Button'

export function SqsExplorerModule() {
  const connections = useConnectionsStore((s) => s.connections)
  const [showConnections, setShowConnections] = useState(connections.length === 0)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h1 className="text-sm font-semibold">SQS Explorer</h1>
        {connections.length === 0 && (
          <Button variant="primary" onClick={() => setShowConnections(true)}>
            <Plug size={14} />
            Conectar a AWS
          </Button>
        )}
      </header>

      {!import.meta.env.DEV && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={14} className="shrink-0" />
          Amazon SQS no soporta CORS: en este sitio publicado la UI carga, pero las llamadas a AWS van a fallar. Para
          uso real, cloná el repo y corré <code className="rounded bg-black/10 px-1 dark:bg-white/10">npm run dev</code>.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <QueueSidebar onOpenConnections={() => setShowConnections(true)} />
        <MessageExplorer />
      </div>

      {showConnections && <ConnectionManager onClose={() => setShowConnections(false)} />}
    </div>
  )
}
