import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AwsConnection, NewAwsConnection } from '../types/connection'

interface ConnectionsState {
  connections: AwsConnection[]
  activeConnectionId: string | null
  addConnection: (conn: NewAwsConnection) => string
  updateConnection: (id: string, patch: Partial<NewAwsConnection>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
}

export const useConnectionsStore = create<ConnectionsState>()(
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
    { name: 'sqs-explorer-connections' },
  ),
)
