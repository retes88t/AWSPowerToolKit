import { useState } from 'react'
import { Plug } from 'lucide-react'
import { useS3ConnectionsStore } from '../../store/s3ConnectionsStore'
import { useS3ExplorerStore } from '../../store/s3ExplorerStore'
import { BucketSidebar } from '../../components/S3Explorer/BucketSidebar'
import { S3ConnectionManager } from '../../components/S3Explorer/S3ConnectionManager'
import { ObjectBrowser } from '../../components/S3Explorer/ObjectBrowser'
import { ObjectDetailDrawer } from '../../components/S3Explorer/ObjectDetailDrawer'
import { Button } from '../../components/common/Button'

export function S3ExplorerModule() {
  const connections = useS3ConnectionsStore((s) => s.connections)
  const [showConnections, setShowConnections] = useState(connections.length === 0)

  const tabs = useS3ExplorerStore((s) => s.tabs)
  const activeTabKey = useS3ExplorerStore((s) => s.activeTabKey)
  const setObjects = useS3ExplorerStore((s) => s.setObjects)
  const activeTab = tabs.find((t) => t.key === activeTabKey)
  const activeConnection = connections.find((c) => c.id === activeTab?.connectionId) ?? null

  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h1 className="text-sm font-semibold">S3 Explorer</h1>
        {connections.length === 0 && (
          <Button variant="primary" onClick={() => setShowConnections(true)}>
            <Plug size={14} />
            Conectar a AWS
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <BucketSidebar onOpenConnections={() => setShowConnections(true)} />

        {activeTab && activeConnection ? (
          <div className="flex min-h-0 flex-1">
            <ObjectBrowser
              key={activeTab.key}
              tab={activeTab}
              connection={activeConnection}
              selectedKey={selectedKey}
              onSelect={(object) => setSelectedKey(object.key)}
            />

            {selectedKey && (
              <ObjectDetailDrawer
                connection={activeConnection}
                bucket={activeTab.bucket}
                objectKey={selectedKey}
                onClose={() => setSelectedKey(null)}
                onDeleted={() => {
                  setObjects(
                    activeTab.key,
                    activeTab.objects.filter((o) => o.key !== selectedKey),
                  )
                  setSelectedKey(null)
                }}
                onRenamed={(newKey) => {
                  setObjects(
                    activeTab.key,
                    activeTab.objects.map((o) => (o.key === selectedKey ? { ...o, key: newKey } : o)),
                  )
                  setSelectedKey(newKey)
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Elegí un bucket del panel izquierdo para empezar a explorar objetos.
          </div>
        )}
      </div>

      {showConnections && <S3ConnectionManager onClose={() => setShowConnections(false)} />}
    </div>
  )
}
