import { useState } from 'react'
import { Download, RefreshCw, Trash2, SendHorizontal, Eraser } from 'lucide-react'
import { Button } from '../common/Button'
import type { QueueSummary } from '../../types/queue'
import type { ReceiveOptions } from '../../aws/sqsService'

interface ToolbarProps {
  queue: QueueSummary
  isBusy: boolean
  messageCount: number
  onReceive: (options: ReceiveOptions) => void
  onClearBuffer: () => void
  onRefreshStats: () => void
  onPurge: () => void
  onSendClick: () => void
}

export function Toolbar({ queue, isBusy, messageCount, onReceive, onClearBuffer, onRefreshStats, onPurge, onSendClick }: ToolbarProps) {
  const [maxMessages, setMaxMessages] = useState(20);
  const [visibilityTimeoutSeconds, setVisibilityTimeoutSeconds] = useState(30);
  const [releaseAfterReceive, setReleaseAfterReceive] = useState(true);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <Stat label="Visibles" value={queue.approxMessages} />
        <Stat label="En vuelo" value={queue.approxMessagesNotVisible} />
        <Stat label="Retrasados" value={queue.approxMessagesDelayed} />
        <button onClick={onRefreshStats} className="hover:text-gray-700 dark:hover:text-gray-200" aria-label="Refrescar stats">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
          Cant.
          <input
            type="number"
            min={1}
            max={500}
            value={maxMessages}
            onChange={(e) => setMaxMessages(Number(e.target.value))}
            className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>

        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
          Visib. (s)
          <input
            type="number"
            min={0}
            max={43200}
            value={visibilityTimeoutSeconds}
            onChange={(e) => setVisibilityTimeoutSeconds(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>

        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300" title="Restaura la visibilidad a 0 apenas se lee cada mensaje, simulando un 'peek' no destructivo">
          <input
            type="checkbox"
            checked={releaseAfterReceive}
            onChange={(e) => setReleaseAfterReceive(e.target.checked)}
          />
          Modo peek
        </label>

        <Button
          variant="primary"
          disabled={isBusy}
          onClick={() =>
            onReceive({ maxMessages, visibilityTimeoutSeconds, waitTimeSeconds: 2, releaseAfterReceive })
          }
        >
          <Download size={14} />
          Recibir mensajes
        </Button>

        <Button variant="secondary" disabled={messageCount === 0} onClick={onClearBuffer}>
          <Eraser size={14} />
          Limpiar buffer
        </Button>

        <Button variant="secondary" onClick={onSendClick}>
          <SendHorizontal size={14} />
          Enviar
        </Button>

        <Button variant="danger" onClick={onPurge}>
          <Trash2 size={14} />
          Purgar cola
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <span>
      {label}: <strong className="text-gray-700 dark:text-gray-200">{value ?? '—'}</strong>
    </span>
  )
}
