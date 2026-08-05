import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { S3Connection, NewS3Connection } from '../types/s3Connection'

interface S3ConnectionsState {
  connections: S3Connection[]
  activeConnectionId: string | null
  addConnection: (conn: NewS3Connection) => string
  updateConnection: (id: string, patch: Partial<NewS3Connection>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
}

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
    { name: 'aws-powertoolkit-s3-connections' },
  ),
)
