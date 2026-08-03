import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../common/Button'
import type { AwsConnection, NewAwsConnection } from '../../types/connection'

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

interface ConnectionFormProps {
  initial?: AwsConnection
  onSubmit: (conn: NewAwsConnection) => void
  onCancel: () => void
}

export function ConnectionForm({ initial, onSubmit, onCancel }: ConnectionFormProps) {
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
        mínimos (sqs:ListQueues, GetQueueAttributes, ReceiveMessage, DeleteMessage, SendMessage, ChangeMessageVisibility,
        PurgeQueue) y, si es posible, credenciales temporales.
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
