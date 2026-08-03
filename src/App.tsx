import { useState } from 'react'
import { Plug } from 'lucide-react'
import { useConnectionsStore } from './store/connectionsStore'
import { QueueSidebar } from './components/QueueSidebar/QueueSidebar'
import { MessageExplorer } from './components/MessageExplorer/MessageExplorer'
import { ConnectionManager } from './components/ConnectionManager/ConnectionManager'
import { Button } from './components/common/Button'

function App() {
  const connections = useConnectionsStore((s) => s.connections)
  const [showConnections, setShowConnections] = useState(connections.length === 0)

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h1 className="text-sm font-semibold">SQS Explorer</h1>
        {connections.length === 0 && (
          <Button variant="primary" onClick={() => setShowConnections(true)}>
            <Plug size={14} />
            Conectar a AWS
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <QueueSidebar onOpenConnections={() => setShowConnections(true)} />
        <MessageExplorer />
      </div>

      {showConnections && <ConnectionManager onClose={() => setShowConnections(false)} />}
    </div>
  )
}

export default App
