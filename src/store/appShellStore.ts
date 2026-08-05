import { create } from 'zustand'
import type { ModuleId } from '../types/module'

interface AppShellState {
  activeModule: ModuleId
  setActiveModule: (id: ModuleId) => void
}

export const useAppShellStore = create<AppShellState>((set) => ({
  activeModule: 'sqs',
  setActiveModule: (id) => set({ activeModule: id }),
}))
