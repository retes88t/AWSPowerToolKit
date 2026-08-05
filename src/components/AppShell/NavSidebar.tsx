import { MessageSquare, Folder, Database, type LucideIcon } from 'lucide-react'
import { MODULES } from '../../types/module'
import { useAppShellStore } from '../../store/appShellStore'

const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  Folder,
  Database,
}

export function NavSidebar() {
  const activeModule = useAppShellStore((s) => s.activeModule)
  const setActiveModule = useAppShellStore((s) => s.setActiveModule)

  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-gray-50 py-3 dark:border-gray-700 dark:bg-gray-900">
      {MODULES.map((mod) => {
        const Icon = ICONS[mod.icon]
        const isActive = mod.id === activeModule
        return (
          <button
            key={mod.id}
            onClick={() => setActiveModule(mod.id)}
            title={mod.label}
            aria-label={mod.label}
            className={`flex w-12 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] ${
              isActive
                ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {Icon && <Icon size={18} />}
            <span className="truncate">{mod.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
