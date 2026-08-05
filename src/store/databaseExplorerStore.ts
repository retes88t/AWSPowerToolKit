import { create } from 'zustand'

export interface DatabaseTab {
  key: string
  connectionId: string
  database: string
  collection: string
  /** JSON text of the current `find` filter, as edited in QueryEditor. */
  filter: string
  documents: unknown[]
  isLoading: boolean
  lastError: string | null
}

export function databaseTabKey(connectionId: string, database: string, collection: string): string {
  return `${connectionId}:${database}:${collection}`
}

interface DatabaseExplorerState {
  tabs: DatabaseTab[]
  activeTabKey: string | null
  openCollectionTab: (connectionId: string, database: string, collection: string) => void
  closeCollectionTab: (key: string) => void
  setActiveTab: (key: string) => void
  setFilter: (key: string, filter: string) => void
  setDocuments: (key: string, documents: unknown[]) => void
  setLoading: (key: string, loading: boolean) => void
  setError: (key: string, error: string | null) => void
  clearDocuments: (key: string) => void
}

export const useDatabaseExplorerStore = create<DatabaseExplorerState>((set) => ({
  tabs: [],
  activeTabKey: null,

  openCollectionTab: (connectionId, database, collection) =>
    set((state) => {
      const key = databaseTabKey(connectionId, database, collection)
      if (state.tabs.some((t) => t.key === key)) {
        return { activeTabKey: key }
      }
      const tab: DatabaseTab = {
        key,
        connectionId,
        database,
        collection,
        filter: '{}',
        documents: [],
        isLoading: false,
        lastError: null,
      }
      return { tabs: [...state.tabs, tab], activeTabKey: key }
    }),

  closeCollectionTab: (key) =>
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

  setFilter: (key, filter) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, filter } : t)) })),

  setDocuments: (key, documents) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, documents } : t)) })),

  setLoading: (key, loading) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, isLoading: loading } : t)) })),

  setError: (key, error) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, lastError: error } : t)) })),

  clearDocuments: (key) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, documents: [] } : t)) })),
}))
