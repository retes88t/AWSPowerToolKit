import { useState, type FormEvent, type ReactNode } from 'react'
import { Plug, Pencil, Trash2, Plus } from 'lucide-react'
import { useS3ConnectionsStore } from '../../store/s3ConnectionsStore'
import type { S3Connection, NewS3Connection } from '../../types/s3Connection'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Button } from '../common/Button'

const COMMON_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'sa-east-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
]

interface S3ConnectionManagerProps {
  onClose: () => void
}

export function S3ConnectionManager({ onClose }: S3ConnectionManagerProps) {
  const connections = useS3ConnectionsStore((s) => s.connections)
  const activeConnectionId = useS3ConnectionsStore((s) => s.activeConnectionId)
  const addConnection = useS3ConnectionsStore((s) => s.addConnection)
  const updateConnection = useS3ConnectionsStore((s) => s.updateConnection)
  const removeConnection = useS3ConnectionsStore((s) => s.removeConnection)
  const setActiveConnection = useS3ConnectionsStore((s) => s.setActiveConnection)

  const [mode, setMode] = useState<'list' | 'add' | { edit: S3Connection }>('list')
  const [pendingDelete, setPendingDelete] = useState<S3Connection | null>(null)

  if (mode === 'add') {
    return (
      <Modal title="Nueva conexión S3" onClose={() => setMode('list')}>
        <S3ConnectionForm
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
        <S3ConnectionForm
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
    <Modal title="Conexiones S3" onClose={onClose}>
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

interface S3ConnectionFormProps {
  initial?: S3Connection
  onSubmit: (conn: NewS3Connection) => void
  onCancel: () => void
}

function S3ConnectionForm({ initial, onSubmit, onCancel }: S3ConnectionFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [region, setRegion] = useState(initial?.region ?? COMMON_REGIONS[0])
  const [accessKeyId, setAccessKeyId] = useState(initial?.accessKeyId ?? '')
  const [secretAccessKey, setSecretAccessKey] = useState(initial?.secretAccessKey ?? '')
  const [sessionToken, setSessionToken] = useState(initial?.sessionToken ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ name, region, accessKeyId, secretAccessKey, sessionToken: sessionToken || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Las credenciales se guardan sin cifrar en el localStorage del navegador. Usá un usuario IAM con permisos
        mínimos (s3:ListAllMyBuckets, ListBucket, GetObject, DeleteObject, PutObject, RestoreObject) y, si es posible,
        credenciales temporales.
      </div>

      <Field label="Nombre de la conexión">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prod - us-east-1"
          className={inputClass}
        />
      </Field>

      <Field label="Región">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
          {COMMON_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Access Key ID">
        <input
          required
          value={accessKeyId}
          onChange={(e) => setAccessKeyId(e.target.value)}
          className={`${inputClass} font-mono`}
          autoComplete="off"
        />
      </Field>

      <Field label="Secret Access Key">
        <input
          required
          type="password"
          value={secretAccessKey}
          onChange={(e) => setSecretAccessKey(e.target.value)}
          className={`${inputClass} font-mono`}
          autoComplete="off"
        />
      </Field>

      <Field label="Session Token (opcional, para credenciales temporales)">
        <input
          value={sessionToken}
          onChange={(e) => setSessionToken(e.target.value)}
          className={`${inputClass} font-mono`}
          autoComplete="off"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          {initial ? 'Guardar cambios' : 'Agregar conexión'}
        </Button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  )
}
