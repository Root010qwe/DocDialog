import { create } from 'zustand'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface UIState {
  sidebarOpen: boolean
  notifications: Notification[]
  toggleSidebar: () => void
  notify: (type: Notification['type'], message: string) => void
  dismissNotification: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  notifications: [],

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  notify: (type, message) => {
    const id = crypto.randomUUID()
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }))
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }))
    }, 4000)
  },

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))
