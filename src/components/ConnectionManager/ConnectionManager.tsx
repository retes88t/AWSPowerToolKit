import { useState } from 'react'
import { Plug, Pencil, Trash2, Plus } from 'lucide-react'
import { useConnectionsStore } from '../../store/connectionsStore'
import type { AwsConnection } from '../../types/connection'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Button } from '../common/Button'
import { ConnectionForm } from './ConnectionForm'

interface ConnectionManagerProps {
  onClose: () => void
}

export function ConnectionManager({ onClose }: ConnectionManagerProps) {
  const connections = useConnectionsStore((s) => s.connections)
  const activeConnectionId = useConnectionsStore((s) => s.activeConnectionId)
  const addConnection = useConnectionsStore((s) => s.addConnection)
  const updateConnection = useConnectionsStore((s) => s.updateConnection)
  const removeConnection = useConnectionsStore((s) => s.removeConnection)
  const setActiveConnection = useConnectionsStore((s) => s.setActiveConnection)

  const [mode, setMode] = useState<'list' | 'add' | { edit: AwsConnection }>('list')
  const [pendingDelete, setPendingDelete] = useState<AwsConnection | null>(null)

  if (mode === 'add') {
    return (
      <Modal title="Nueva conexión AWS" onClose={() => setMode('list')}>
        <ConnectionForm
          onCancel={() => setMode('list')}
          onSubmit={(conn) => {
            addConnection(conn)
            setMode('list')
          }}
        />
      </Modal>
    )
  }

  if (typeof mode === 'object') {
    return (
      <Modal title="Editar conexión" onClose={() => setMode('list')}>
        <ConnectionForm
          initial={mode.edit}
          onCancel={() => setMode('list')}
          onSubmit={(conn) => {
            updateConnection(mode.edit.id, conn)
            setMode('list')
          }}
        />
      </Modal>
    )
  }

  return (
    <Modal title="Conexiones AWS" onClose={onClose}>
      <div className="space-y-2">
        {connections.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Todavía no agregaste ninguna conexión.
          </p>
        )}

        {connections.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between rounded-md border px-3 py-2 ${
              c.id === activeConnectionId
                ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <button
              className="flex flex-1 items-center gap-2 text-left"
              onClick={() => {
                setActiveConnection(c.id)
                onClose()
              }}
            >
              <Plug size={14} className="shrink-0 text-gray-400" />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{c.region}</span>
              </span>
            </button>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" onClick={() => setMode({ edit: c })} aria-label="Editar">
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" onClick={() => setPendingDelete(c)} aria-label="Eliminar">
                <Trash2 size={14} className="text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={() => setMode('add')}>
          <Plus size={14} />
          Nueva conexión
        </Button>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar conexión"
          message={`¿Eliminar la conexión "${pendingDelete.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            removeConnection(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </Modal>
  )
}
