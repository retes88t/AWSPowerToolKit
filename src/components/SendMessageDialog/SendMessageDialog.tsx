import { useState } from 'react'
import { Plus, X, Wand2 } from 'lucide-react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import type { QueueSummary } from '../../types/queue'
import type { SendMessageInput } from '../../aws/sqsService'
import { formatJson } from '../../utils/json'

interface AttributeRow {
  id: string
  name: string
  type: string
  value: string
}

interface SendMessageDialogProps {
  queue: QueueSummary
  initial?: { body: string; attributes: { name: string; type: string; value: string }[] }
  onSend: (input: SendMessageInput) => Promise<void>
  onClose: () => void
}

export function SendMessageDialog({ queue, initial, onSend, onClose }: SendMessageDialogProps) {
  const [body, setBody] = useState(initial?.body ?? '')
  const [bodyType, setBodyType] = useState<'text' | 'json'>('text')
  const [bodyFormatError, setBodyFormatError] = useState<string | null>(null)
  const [attributes, setAttributes] = useState<AttributeRow[]>(
    (initial?.attributes ?? []).map((a) => ({ id: crypto.randomUUID(), ...a })),
  )
  const [delaySeconds, setDelaySeconds] = useState(0)
  const [messageGroupId, setMessageGroupId] = useState('')
  const [messageDeduplicationId, setMessageDeduplicationId] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addAttribute() {
    setAttributes([...attributes, { id: crypto.randomUUID(), name: '', type: 'String', value: '' }])
  }

  function updateAttribute(id: string, patch: Partial<AttributeRow>) {
    setAttributes(attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  function removeAttribute(id: string) {
    setAttributes(attributes.filter((a) => a.id !== id))
  }

  function handleFormatBody() {
    try {
      setBody((current) => formatJson(current))
      setBodyFormatError(null)
    } catch {
      setBodyFormatError('El body no es un JSON válido')
    }
  }

  async function handleSend() {
    setError(null)
    setIsSending(true)
    try {
      await onSend({
        body,
        attributes: attributes.map(({ name, type, value }) => ({ name, type, value })),
        delaySeconds,
        messageGroupId,
        messageDeduplicationId,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Modal title={`Enviar mensaje a ${queue.name}`} onClose={onClose} widthClassName="max-w-xl">
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Body</span>
            <div className="flex items-center gap-1.5">
              <select
                value={bodyType}
                onChange={(e) => {
                  setBodyType(e.target.value as 'text' | 'json')
                  setBodyFormatError(null)
                }}
                className="rounded-md border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="text">Texto plano</option>
                <option value="json">JSON</option>
              </select>
              {bodyType === 'json' && (
                <Button variant="ghost" onClick={handleFormatBody} className="px-1.5 py-0.5 text-xs">
                  <Wand2 size={12} />
                  Formatear
                </Button>
              )}
            </div>
          </div>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setBodyFormatError(null)
            }}
            rows={6}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {bodyFormatError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{bodyFormatError}</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Atributos de mensaje</span>
            <Button variant="ghost" onClick={addAttribute} className="text-xs">
              <Plus size={12} />
              Agregar
            </Button>
          </div>
          <div className="space-y-1.5">
            {attributes.map((attr) => (
              <div key={attr.id} className="flex items-center gap-1.5">
                <input
                  placeholder="nombre"
                  value={attr.name}
                  onChange={(e) => updateAttribute(attr.id, { name: e.target.value })}
                  className="w-1/3 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                <select
                  value={attr.type}
                  onChange={(e) => updateAttribute(attr.id, { type: e.target.value })}
                  className="rounded-md border border-gray-300 px-1 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="String">String</option>
                  <option value="Number">Number</option>
                  <option value="Binary">Binary</option>
                </select>
                <input
                  placeholder="valor"
                  value={attr.value}
                  onChange={(e) => updateAttribute(attr.id, { value: e.target.value })}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                <button onClick={() => removeAttribute(attr.id)} className="text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {!queue.isFifo && (
          <label className="block w-40">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Delay (segundos)</span>
            <input
              type="number"
              min={0}
              max={900}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
        )}

        {queue.isFifo && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">MessageGroupId</span>
              <input
                value={messageGroupId}
                onChange={(e) => setMessageGroupId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                MessageDeduplicationId
              </span>
              <input
                value={messageDeduplicationId}
                onChange={(e) => setMessageDeduplicationId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
          </div>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSend} disabled={isSending || !body}>
            {isSending ? 'Enviando…' : 'Enviar mensaje'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
