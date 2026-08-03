import { X } from 'lucide-react'
import { useExplorerStore } from '../../store/explorerStore'

export function TabsBar() {
  const tabs = useExplorerStore((s) => s.tabs)
  const activeTabKey = useExplorerStore((s) => s.activeTabKey)
  const setActiveTab = useExplorerStore((s) => s.setActiveTab)
  const closeQueueTab = useExplorerStore((s) => s.closeQueueTab)

  if (tabs.length === 0) return null

  return (
    <div className="flex shrink-0 overflow-x-auto border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {tabs.map((tab) => (
        <div
          key={tab.key}
          className={`group flex shrink-0 cursor-pointer items-center gap-2 border-r border-gray-200 px-3 py-2 text-sm dark:border-gray-700 ${
            tab.key === activeTabKey
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
          onClick={() => setActiveTab(tab.key)}
        >
          <span className="max-w-40 truncate">{tab.queue.name}</span>
          <button
            className="rounded p-0.5 opacity-0 hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation()
              closeQueueTab(tab.key)
            }}
            aria-label="Cerrar pestaña"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
