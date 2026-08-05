import { useState, type FormEvent, type ReactNode } from 'react'
import { Plug, Pencil, Trash2, Plus } from 'lucide-react'
import { useMongoConnectionsStore } from '../../store/mongoConnectionsStore'
import type { MongoConnection, NewMongoConnection } from '../../types/mongoConnection'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Button } from '../common/Button'

interface MongoConnectionManagerProps {
  onClose: () => void
}

export function MongoConnectionManager({ onClose }: MongoConnectionManagerProps) {
  const connections = useMongoConnectionsStore((s) => s.connections)
  const activeConnectionId = useMongoConnectionsStore((s) => s.activeConnectionId)
  const addConnection = useMongoConnectionsStore((s) => s.addConnection)
  const updateConnection = useMongoConnectionsStore((s) => s.updateConnection)
  const removeConnection = useMongoConnectionsStore((s) => s.removeConnection)
  const setActiveConnection = useMongoConnectionsStore((s) => s.setActiveConnection)

  const [mode, setMode] = useState<'list' | 'add' | { edit: MongoConnection }>('list')
  const [pendingDelete, setPendingDelete] = useState<MongoConnection | null>(null)

  if (mode === 'add') {
    return (
      <Modal title="Nueva conexión Mongo" onClose={() => setMode('list')}>
        <MongoConnectionForm
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
        <MongoConnectionForm
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
    <Modal title="Conexiones Database" onClose={onClose}>
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
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {c.connectionString ? 'connection string' : `${c.host ?? '?'}:${c.port ?? '?'}`}
                </span>
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

type ConnectionMode = 'connectionString' | 'fields'

interface MongoConnectionFormProps {
  initial?: MongoConnection
  onSubmit: (conn: NewMongoConnection) => void
  onCancel: () => void
}

function MongoConnectionForm({ initial, onSubmit, onCancel }: MongoConnectionFormProps) {
  const [connMode, setConnMode] = useState<ConnectionMode>(
    initial && !initial.connectionString && (initial.host || initial.username) ? 'fields' : 'connectionString',
  )
  const [name, setName] = useState(initial?.name ?? '')
  const [connectionString, setConnectionString] = useState(initial?.connectionString ?? '')
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState(initial?.port ? String(initial.port) : '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [database, setDatabase] = useState(initial?.database ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (connMode === 'connectionString') {
      onSubmit({
        name,
        connectionString,
        host: undefined,
        port: undefined,
        username: undefined,
        password: undefined,
        database: database || undefined,
      })
    } else {
      onSubmit({
        name,
        connectionString: undefined,
        host,
        port: port ? Number(port) : undefined,
        username: username || undefined,
        password: password || undefined,
        database: database || undefined,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Las credenciales se guardan sin cifrar en el localStorage del navegador. Este módulo solo funciona corriendo
        `npm run dev` (depende del proxy de Mongo de solo-desarrollo).
      </div>

      <Field label="Nombre de la conexión">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prod - Mongo"
          className={inputClass}
        />
      </Field>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setConnMode('connectionString')}
          className={`rounded-md px-2.5 py-1 ${
            connMode === 'connectionString'
              ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Connection string
        </button>
        <button
          type="button"
          onClick={() => setConnMode('fields')}
          className={`rounded-md px-2.5 py-1 ${
            connMode === 'fields'
              ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Host / usuario / password
        </button>
      </div>

      {connMode === 'connectionString' ? (
        <Field label="Connection string">
          <input
            required
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="mongodb://usuario:password@host:27017"
            className={`${inputClass} font-mono`}
            autoComplete="off"
          />
        </Field>
      ) : (
        <>
          <div className="flex gap-2">
            <Field label="Host">
              <input
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
                className={inputClass}
              />
            </Field>
            <Field label="Puerto">
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="27017"
                inputMode="numeric"
                className={`${inputClass} w-24`}
              />
            </Field>
          </div>

          <Field label="Usuario (opcional)">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              autoComplete="off"
            />
          </Field>

          <Field label="Password (opcional)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="off"
            />
          </Field>
        </>
      )}

      <Field label="Base de datos por defecto (opcional)">
        <input value={database} onChange={(e) => setDatabase(e.target.value)} className={inputClass} />
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
