import { NavSidebar } from './components/AppShell/NavSidebar'
import { useAppShellStore } from './store/appShellStore'
import { SqsExplorerModule } from './modules/sqs/SqsExplorerModule'
import { S3ExplorerModule } from './modules/s3/S3ExplorerModule'
import { DatabaseExplorerModule } from './modules/database/DatabaseExplorerModule'

function App() {
  const activeModule = useAppShellStore((s) => s.activeModule)

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <h1 className="text-sm font-semibold">AWSPowerToolKit</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <NavSidebar />
        {activeModule === 'sqs' && <SqsExplorerModule />}
        {activeModule === 's3' && <S3ExplorerModule />}
        {activeModule === 'database' && <DatabaseExplorerModule />}
      </div>
    </div>
  )
}

export default App
