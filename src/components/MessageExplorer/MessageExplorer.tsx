import { useExplorerStore } from '../../store/explorerStore'
import { TabsBar } from './TabsBar'
import { QueueView } from './QueueView'

export function MessageExplorer() {
  const tabs = useExplorerStore((s) => s.tabs)
  const activeTabKey = useExplorerStore((s) => s.activeTabKey)
  const activeTab = tabs.find((t) => t.key === activeTabKey)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabsBar />
      {activeTab ? (
        <QueueView key={activeTab.key} tab={activeTab} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          Elegí una cola del panel izquierdo para empezar a explorar mensajes.
        </div>
      )}
    </div>
  )
}
