import { create } from 'zustand'

export interface S3ObjectSummary {
  key: string
  isFolder: boolean
  size?: number
  lastModified?: string
  storageClass?: string
  eTag?: string
}

export interface BucketTab {
  key: string
  connectionId: string
  bucket: string
  currentPrefix: string
  objects: S3ObjectSummary[]
  searchFilter: string
  isLoading: boolean
  lastError: string | null
}

export function bucketTabKey(connectionId: string, bucket: string): string {
  return `${connectionId}:${bucket}`
}

interface S3ExplorerState {
  tabs: BucketTab[]
  activeTabKey: string | null
  openBucketTab: (connectionId: string, bucket: string) => void
  closeBucketTab: (key: string) => void
  setActiveTab: (key: string) => void
  setPrefix: (key: string, prefix: string) => void
  setObjects: (key: string, objects: S3ObjectSummary[]) => void
  setSearchFilter: (key: string, filter: string) => void
  setLoading: (key: string, loading: boolean) => void
  setError: (key: string, error: string | null) => void
  clearObjects: (key: string) => void
}

export const useS3ExplorerStore = create<S3ExplorerState>((set) => ({
  tabs: [],
  activeTabKey: null,

  openBucketTab: (connectionId, bucket) =>
    set((state) => {
      const key = bucketTabKey(connectionId, bucket)
      if (state.tabs.some((t) => t.key === key)) {
        return { activeTabKey: key }
      }
      const tab: BucketTab = {
        key,
        connectionId,
        bucket,
        currentPrefix: '',
        objects: [],
        searchFilter: '',
        isLoading: false,
        lastError: null,
      }
      return { tabs: [...state.tabs, tab], activeTabKey: key }
    }),

  closeBucketTab: (key) =>
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

  setPrefix: (key, prefix) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, currentPrefix: prefix } : t)) })),

  setObjects: (key, objects) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, objects } : t)) })),

  setSearchFilter: (key, filter) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, searchFilter: filter } : t)) })),

  setLoading: (key, loading) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, isLoading: loading } : t)) })),

  setError: (key, error) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, lastError: error } : t)) })),

  clearObjects: (key) =>
    set((state) => ({ tabs: state.tabs.map((t) => (t.key === key ? { ...t, objects: [] } : t)) })),
}))
