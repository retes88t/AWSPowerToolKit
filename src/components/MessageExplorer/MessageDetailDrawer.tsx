import { useEffect, useState, type ReactNode } from 'react'
import { X, Trash2, Send, RotateCcw, Wand2, Copy, Check } from 'lucide-react'
import { Button } from '../common/Button'
import type { SqsMessageVM } from '../../types/message'
import { formatJson } from '../../utils/json'

interface MessageDetailDrawerProps {
  message: SqsMessageVM
  onClose: () => void
  onDelete: () => void
  onRelease: () => void
  onResend: () => void
  isBusy: boolean
}

export function MessageDetailDrawer({ message, onClose, onDelete, onRelease, onResend, isBusy }: MessageDetailDrawerProps) {
  const [bodyType, setBodyType] = useState<'text' | 'json'>('text')
  const [formattedBody, setFormattedBody] = useState<string | null>(null)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setBodyType('text')
    setFormattedBody(null)
    setFormatError(null)
    setCopied(false)
  }, [message.messageId])

  function handleFormatBody() {
    try {
      setFormattedBody(formatJson(message.body))
      setFormatError(null)
    } catch {
      setFormatError('El body no es un JSON válido')
    }
  }

  async function handleCopyBody() {
    try {
      await navigator.clipboard.writeText(displayedBody)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setFormatError('No se pudo copiar al portapapeles')
    }
  }

  const displayedBody = bodyType === 'json' && formattedBody ? formattedBody : message.body

  return (
    <div className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalle del mensaje</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Section
          title="Body"
          actions={
            <div className="flex items-center gap-1.5">
              <select
                value={bodyType}
                onChange={(e) => {
                  setBodyType(e.target.value as 'text' | 'json')
                  setFormatError(null)
                }}
                className="rounded-md border border-gray-300 px-1 py-0.5 text-xs normal-case dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="text">Texto plano</option>
                <option value="json">JSON</option>
              </select>
              {bodyType === 'json' && (
                <Button variant="ghost" onClick={handleFormatBody} className="px-1.5 py-0.5 text-xs normal-case">
                  <Wand2 size={12} />
                  Formatear
                </Button>
              )}
              <Button variant="ghost" onClick={handleCopyBody} className="px-1.5 py-0.5 text-xs normal-case">
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          }
        >
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800 dark:text-gray-100">
            {displayedBody}
          </pre>
          {formatError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formatError}</p>}
        </Section>

        <Section title="Atributos de mensaje (custom)">
          {message.attributes.length === 0 ? (
            <p className="text-xs text-gray-400">Sin atributos</p>
          ) : (
            <AttributeTable rows={message.attributes.map((a) => [a.name, `${a.value} (${a.type})`])} />
          )}
        </Section>

        <Section title="Atributos de sistema">
          <AttributeTable rows={Object.entries(message.systemAttributes)} />
        </Section>

        <Section title="Identificadores">
          <AttributeTable
            rows={[
              ['MessageId', message.messageId],
              ['ReceiptHandle', message.receiptHandle ? `${message.receiptHandle.slice(0, 24)}…` : '—'],
            ]}
          />
        </Section>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
        <Button variant="secondary" onClick={onResend} disabled={isBusy}>
          <Send size={14} />
          Reenviar
        </Button>
        <Button variant="secondary" onClick={onRelease} disabled={isBusy}>
          <RotateCcw size={14} />
          Liberar
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={isBusy}>
          <Trash2 size={14} />
          Borrar
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{title}</h4>
        {actions}
      </div>
      {children}
    </div>
  )
}

function AttributeTable({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <p className="text-xs text-gray-400">—</p>
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([key, value]) => (
          <tr key={key} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
            <td className="py-1 pr-2 font-medium text-gray-500 dark:text-gray-400">{key}</td>
            <td className="py-1 font-mono break-all text-gray-800 dark:text-gray-200">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
