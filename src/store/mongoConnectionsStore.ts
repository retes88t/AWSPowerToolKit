import { create } from 'zustand'
import { createJSONStorage, persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import type { MongoConnection, NewMongoConnection } from '../types/mongoConnection'
import { isDesktopBridgeAvailable } from '../bridge/desktopBridge'
import * as mongoBridge from '../bridge/mongoBridge'

interface MongoConnectionsState {
  connections: MongoConnection[]
  activeConnectionId: string | null
  addConnection: (conn: NewMongoConnection) => string
  updateConnection: (id: string, patch: Partial<NewMongoConnection>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
}

// Which connection is "active" is pure UI state (not credentials), so it's kept in
// `localStorage` even when the desktop bridge is available — only the connection list
// itself (which carries secrets) is delegated to `access.json` via the bridge.
const ACTIVE_CONNECTION_STORAGE_KEY = 'aws-powertoolkit-mongo-active-connection'

/**
 * When running embedded in the .NET WebView2 host (`isDesktopBridgeAvailable()`, T2),
 * persists/reads the connection list via `mongoBridge.listConnections`/`saveConnections`
 * (T9/T13), which round-trip through `access.json` on the .NET side (T5) instead of
 * `localStorage`. Outside the bridge (published site, `npm run dev`), behavior is
 * unchanged: falls back to the default `localStorage`-backed JSON storage — this module
 * doesn't work outside `npm run dev` either way (no Mongo dev proxy on the published site).
 */
function createMongoConnectionsStorage(): PersistStorage<MongoConnectionsState> {
  return {
    getItem: async (name) => {
      if (!isDesktopBridgeAvailable()) {
        return (createJSONStorage<MongoConnectionsState>(() => localStorage)?.getItem(name) ?? null) as
          | StorageValue<MongoConnectionsState>
          | null
      }

      const connections = await mongoBridge.listConnections()
      const activeConnectionId = window.localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY)
      return {
        state: { connections, activeConnectionId } as MongoConnectionsState,
        version: 0,
      }
    },
    setItem: async (name, value) => {
      if (!isDesktopBridgeAvailable()) {
        createJSONStorage<MongoConnectionsState>(() => localStorage)?.setItem(name, value)
        return
      }

      await mongoBridge.saveConnections(value.state.connections)
      if (value.state.activeConnectionId) {
        window.localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, value.state.activeConnectionId)
      } else {
        window.localStorage.removeItem(ACTIVE_CONNECTION_STORAGE_KEY)
      }
    },
    removeItem: async (name) => {
      if (!isDesktopBridgeAvailable()) {
        createJSONStorage<MongoConnectionsState>(() => localStorage)?.removeItem(name)
        return
      }

      await mongoBridge.saveConnections([])
      window.localStorage.removeItem(ACTIVE_CONNECTION_STORAGE_KEY)
    },
  }
}

export const useMongoConnectionsStore = create<MongoConnectionsState>()(
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
    { name: 'aws-powertoolkit-mongo-connections', storage: createMongoConnectionsStorage() },
  ),
)
