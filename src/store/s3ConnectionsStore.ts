import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { S3Connection, NewS3Connection } from '../types/s3Connection'
import { callBridge, isDesktopBridgeAvailable } from '../bridge/desktopBridge'

interface S3ConnectionsState {
  connections: S3Connection[]
  activeConnectionId: string | null
  addConnection: (conn: NewS3Connection) => string
  updateConnection: (id: string, patch: Partial<NewS3Connection>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
}

// Storage backend for the `persist` middleware below. Outside the desktop host (published
// site, `npm run dev`) this is plain `localStorage`, exactly as before. Embedded in the .NET
// WebView2 host (`isDesktopBridgeAvailable()`, see desktopBridge.ts), connections round-trip
// through `access.json` instead via `access.listS3Connections`/`access.saveS3Connections`
// (registered in Form1.cs, backed by AccessStoreService — see workplan T5/T12). Only the
// `connections` list is persisted through the bridge; `activeConnectionId` is UI-only state
// with no equivalent in `access.json`, so under the bridge it simply resets to `null` across
// app restarts (a connection still needs to be picked again, same as a fresh browser profile).
const bridgeStorage: StateStorage = {
  getItem: async (_name) => {
    const connections = await callBridge<Record<string, never>, S3Connection[]>(
      'access.listS3Connections',
      {},
    )
    return JSON.stringify({ state: { connections, activeConnectionId: null }, version: 0 })
  },
  setItem: async (_name, value) => {
    const parsed = JSON.parse(value) as { state: { connections: S3Connection[] } }
    await callBridge('access.saveS3Connections', { connections: parsed.state.connections })
  },
  removeItem: async () => {
    await callBridge('access.saveS3Connections', { connections: [] })
  },
}

const storage = createJSONStorage<S3ConnectionsState>(() =>
  isDesktopBridgeAvailable() ? bridgeStorage : localStorage,
)

export const useS3ConnectionsStore = create<S3ConnectionsState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      addConnection: (conn) => {
        const id = crypto.randomUUID()
        set((state) => ({
          connections: [...state.connections, { ...conn, id }],
          activeConnectionId: id,
        }))
        return id
      },
      updateConnection: (id, patch) =>
        set((state) => ({
          connections: state.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        })),
      setActiveConnection: (id) => set({ activeConnectionId: id }),
    }),
    { name: 'aws-powertoolkit-s3-connections', storage },
  ),
)
