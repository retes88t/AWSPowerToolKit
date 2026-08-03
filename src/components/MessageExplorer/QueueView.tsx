import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { useExplorerStore, type QueueTab } from '../../store/explorerStore'
import { useConnectionsStore } from '../../store/connectionsStore'
import {
  deleteMessage,
  getQueueSummary,
  purgeQueue,
  receiveMessages,
  releaseMessage,
  sendMessage,
  type ReceiveOptions,
} from '../../aws/sqsService'
import { filterMessages } from '../../utils/attributeFilter'
import { getMessageTimestamp } from '../../utils/messageTime'
import { Toolbar } from './Toolbar'
import { FilterBar } from './FilterBar'
import { MessageTable } from './MessageTable'
import { MessageDetailDrawer } from './MessageDetailDrawer'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { SendMessageDialog } from '../SendMessageDialog/SendMessageDialog'
import type { SqsMessageVM } from '../../types/message'

export function QueueView({ tab }: { tab: QueueTab }) {
  const connection = useConnectionsStore((s) => s.connections.find((c) => c.id === tab.connectionId))
  const setMessages = useExplorerStore((s) => s.setMessages)
  const appendMessages = useExplorerStore((s) => s.appendMessages)
  const removeMessage = useExplorerStore((s) => s.removeMessage)
  const setLoading = useExplorerStore((s) => s.setLoading)
  const setError = useExplorerStore((s) => s.setError)
  const setFilters = useExplorerStore((s) => s.setFilters)
  const updateQueueSummary = useExplorerStore((s) => s.updateQueueSummary)

  const [selectedMessage, setSelectedMessage] = useState<SqsMessageVM | null>(null)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [sendDialogPrefill, setSendDialogPrefill] = useState<{
    body: string
    attributes: { name: string; type: string; value: string }[]
  } | null>(null)
  const [showSendDialog, setShowSendDialog] = useState(false)

  const receiveMutation = useMutation({
    mutationFn: (options: ReceiveOptions) => {
      setLoading(tab.key, true)
      setError(tab.key, null)
      return receiveMessages(connection!, tab.queue, options)
    },
    onSuccess: (messages) => {
      appendMessages(tab.key, messages)
      setLoading(tab.key, false)
    },
    onError: (err: Error) => {
      setError(tab.key, err.message)
      setLoading(tab.key, false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (message: SqsMessageVM) => deleteMessage(connection!, tab.queue, message.receiptHandle),
    onSuccess: (_data, message) => {
      removeMessage(tab.key, message.messageId)
      setSelectedMessage((cur) => (cur?.messageId === message.messageId ? null : cur))
    },
    onError: (err: Error) => setError(tab.key, err.message),
  })

  const releaseMutation = useMutation({
    mutationFn: (message: SqsMessageVM) => releaseMessage(connection!, tab.queue, message.receiptHandle),
    onSuccess: (_data, message) => {
      removeMessage(tab.key, message.messageId)
      setSelectedMessage((cur) => (cur?.messageId === message.messageId ? null : cur))
    },
    onError: (err: Error) => setError(tab.key, err.message),
  })

  const purgeMutation = useMutation({
    mutationFn: () => purgeQueue(connection!, tab.queue),
    onSuccess: () => {
      setMessages(tab.key, [])
      setSelectedMessage(null)
      setConfirmPurge(false)
    },
    onError: (err: Error) => {
      setError(tab.key, err.message)
      setConfirmPurge(false)
    },
  })

  const refreshStatsMutation = useMutation({
    mutationFn: () => getQueueSummary(connection!, tab.queue),
    onSuccess: (summary) => updateQueueSummary(tab.key, summary),
  })

  const sendMutation = useMutation({
    mutationFn: (input: Parameters<typeof sendMessage>[2]) => sendMessage(connection!, tab.queue, input),
    onSuccess: () => refreshStatsMutation.mutate(),
  })

  if (!connection) {
    return <div className="p-4 text-sm text-red-600">No se encontró la conexión de esta cola.</div>
  }

  const visibleMessages = filterMessages(tab.messages, tab.filters)
    .slice()
    .sort((a, b) => getMessageTimestamp(b) - getMessageTimestamp(a))

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          queue={tab.queue}
          isBusy={tab.isLoading}
          messageCount={tab.messages.length}
          onReceive={(options) => receiveMutation.mutate(options)}
          onClearBuffer={() => {
            setMessages(tab.key, [])
            setSelectedMessage(null)
          }}
          onRefreshStats={() => refreshStatsMutation.mutate()}
          onPurge={() => setConfirmPurge(true)}
          onSendClick={() => {
            setSendDialogPrefill(null)
            setShowSendDialog(true)
          }}
        />
        <FilterBar filters={tab.filters} onChange={(filters) => setFilters(tab.key, filters)} />

        {tab.lastError && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{tab.lastError}</span>
          </div>
        )}

        <div className="flex min-h-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
          <MessageTable
            messages={visibleMessages}
            selectedMessageId={selectedMessage?.messageId ?? null}
            onSelect={setSelectedMessage}
          />
        </div>

        <div className="border-t border-gray-200 px-3 py-1 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Mostrando {visibleMessages.length} de {tab.messages.length} mensajes en buffer
        </div>
      </div>

      {selectedMessage && (
        <MessageDetailDrawer
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onDelete={() => deleteMutation.mutate(selectedMessage)}
          onRelease={() => releaseMutation.mutate(selectedMessage)}
          onResend={() => {
            setSendDialogPrefill({
              body: selectedMessage.body,
              attributes: selectedMessage.attributes.map(({ name, type, value }) => ({ name, type, value })),
            })
            setShowSendDialog(true)
          }}
          isBusy={deleteMutation.isPending || releaseMutation.isPending}
        />
      )}

      {confirmPurge && (
        <ConfirmDialog
          title="Purgar cola"
          message={`Esto borra TODOS los mensajes de "${tab.queue.name}" de forma irreversible (puede tardar hasta 60s en aplicarse del lado de AWS).`}
          confirmLabel="Purgar"
          onCancel={() => setConfirmPurge(false)}
          onConfirm={() => purgeMutation.mutate()}
        />
      )}

      {showSendDialog && (
        <SendMessageDialog
          queue={tab.queue}
          initial={sendDialogPrefill ?? undefined}
          onSend={(input) => sendMutation.mutateAsync(input)}
          onClose={() => setShowSendDialog(false)}
        />
      )}
    </div>
  )
}
