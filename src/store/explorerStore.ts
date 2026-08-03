import { create } from 'zustand'
import type { QueueSummary } from '../types/queue'
import type { SqsMessageVM } from '../types/message'
import type { AttributeFilterRule } from '../types/filter'

export interface QueueTab {
  key: string
  connectionId: string
  queue: QueueSummary
  messages: SqsMessageVM[]
  filters: AttributeFilterRule[]
  isLoading: boolean
  lastError: string | null
}

export function tabKey(connectionId: string, queueUrl: string): string {
  return `${connectionId}:${queueUrl}`
}

interface ExplorerState {
  tabs: QueueTab[]
  activeTabKey: string | null
  openQueueTab: (connectionId: string, queue: QueueSummary) => void
  closeQueueTab: (key: string) => void
  setActiveTab: (key: string) => void
  setMessages: (key: string, messages: SqsMessageVM[]) => void
  appendMessages: (key: string, messages: SqsMessageVM[]) => void
  removeMessage: (key: string, messageId: string) => void
  setLoading: (key: string, loading: boolean) => void
  setError: (key: string, error: string | null) => void
  setFilters: (key: string, filters: AttributeFilterRule[]) => void
  clearMessages: (key: string) => void
  updateQueueSummary: (key: string, queue: QueueSummary) => void
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  tabs: [],
  activeTabKey: null,

  openQueueTab: (connectionId, queue) =>
    set((state) => {
      const key = tabKey(connectionId, queue.url)
      if (state.tabs.some((t) => t.key === key)) {
        return { activeTabKey: key }
      }
      const tab: QueueTab = {
        key,
        connectionId,
        queue,
        messages: [],
        filters: [],
        isLoading: false,
        lastError: null,
      }
      return { tabs: [...state.tabs, tab], activeTabKey: key }
    }),

  closeQueueTab: (key) =>
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.key === key)
      const tabs = state.tabs.filter((t) => t.key !== key)
      let activeTabKey = state.activeTabKey
      if (state.activeTabKey === key) {
        activeTabKey = tabs[idx] ? tabs[idx].key : (tabs[idx - 1]?.key ?? null)
      }
      return { tabs, activeTabKey }
    }),

  setActiveTab: (key) => set({ activeTabKey: key }),

  setMessages: (key, messages) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, messages } : t)) })),

  appendMessages: (key, messages) =>
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.key !== key) return t
        const existingIds = new Set(t.messages.map((m) => m.messageId))
        const merged = [...t.messages, ...messages.filter((m) => !existingIds.has(m.messageId))]
        return { ...t, messages: merged }
      }),
    })),

  removeMessage: (key, messageId) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.key === key ? { ...t, messages: t.messages.filter((m) => m.messageId !== messageId) } : t,
      ),
    })),

  setLoading: (key, loading) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, isLoading: loading } : t)) })),

  setError: (key, error) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, lastError: error } : t)) })),

  setFilters: (key, filters) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, filters } : t)) })),

  clearMessages: (key) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, messages: [] } : t)) })),

  updateQueueSummary: (key, queue) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, queue } : t)) })),
}))
