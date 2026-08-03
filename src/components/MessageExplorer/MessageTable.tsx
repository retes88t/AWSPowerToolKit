import type { SqsMessageVM } from '../../types/message'

interface MessageTableProps {
  messages: SqsMessageVM[]
  selectedMessageId: string | null
  onSelect: (message: SqsMessageVM) => void
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function MessageTable({ messages, selectedMessageId, onSelect }: MessageTableProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No hay mensajes cargados. Usá "Recibir mensajes" para traer del queue.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Body</th>
            <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Atributos</th>
            <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">Recibos</th>
            <th className="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-700">MessageId</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr
              key={m.messageId}
              onClick={() => onSelect(m)}
              className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 ${
                m.messageId === selectedMessageId
                  ? 'bg-indigo-50 dark:bg-indigo-950'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <td className="max-w-md truncate px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                {truncate(m.body)}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                {m.attributes.length === 0 ? '—' : m.attributes.map((a) => a.name).join(', ')}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                {m.systemAttributes.ApproximateReceiveCount ?? '—'}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-400 dark:text-gray-500">
                {truncate(m.messageId, 20)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
