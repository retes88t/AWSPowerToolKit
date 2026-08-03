import type { ReactNode } from 'react'
import { X, Trash2, Send, RotateCcw } from 'lucide-react'
import { Button } from '../common/Button'
import type { SqsMessageVM } from '../../types/message'

interface MessageDetailDrawerProps {
  message: SqsMessageVM
  onClose: () => void
  onDelete: () => void
  onRelease: () => void
  onResend: () => void
  isBusy: boolean
}

export function MessageDetailDrawer({ message, onClose, onDelete, onRelease, onResend, isBusy }: MessageDetailDrawerProps) {
  return (
    <div className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalle del mensaje</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Section title="Body">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800 dark:text-gray-100">
            {message.body}
          </pre>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{title}</h4>
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
