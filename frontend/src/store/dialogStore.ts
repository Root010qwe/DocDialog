import { create } from 'zustand'
import apiClient from '../api/client'
import { useAuthStore } from './authStore'
import type { Citation, Dialog, DialogMessage } from '../types/dialog'
import type { SSECitation } from '../types/dialog'

interface DialogState {
  dialogs: Dialog[]
  currentDialog: Dialog | null
  messages: DialogMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamController: AbortController | null

  createDialog: (collectionId: string) => Promise<Dialog>
  setCurrentDialog: (dialog: Dialog | null) => Promise<void>
  fetchDialogs: () => Promise<void>
  fetchMessages: (dialogId: string) => Promise<void>
  streamMessage: (dialogId: string, content: string) => Promise<void>
  setMessages: (messages: DialogMessage[]) => void
  reset: () => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  dialogs: [],
  currentDialog: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamController: null,

  reset: () => {
    const controller = get().streamController
    if (controller) {
      controller.abort()
    }
    set({
      dialogs: [],
      currentDialog: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      streamController: null,
    })
  },

  createDialog: async (collectionId: string) => {
    set({ isLoading: true })
    try {
      const response = await apiClient.post<Dialog>('/dialogs', {
        collection_id: collectionId,
      })
      set((state) => ({ dialogs: [response.data, ...state.dialogs] }))
      return response.data
    } finally {
      set({ isLoading: false })
    }
  },

  setCurrentDialog: async (dialog) => {
    const controller = get().streamController
    if (controller) {
      controller.abort()
      set({ streamController: null, isStreaming: false })
    }
    set({ currentDialog: dialog, messages: [] })
    if (dialog) {
      await get().fetchMessages(dialog.id)
    }
  },

  fetchDialogs: async () => {
    set({ isLoading: true })
    try {
      const response = await apiClient.get<Dialog[]>('/dialogs')
      set({ dialogs: response.data })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchMessages: async (dialogId: string) => {
    try {
      const response = await apiClient.get<DialogMessage[]>(`/dialogs/${dialogId}/messages`)
      set({ messages: response.data })
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  },

  streamMessage: async (dialogId: string, content: string) => {
    const prevController = get().streamController
    if (prevController) {
      prevController.abort()
    }

    const controller = new AbortController()
    set({ isStreaming: true, streamController: controller })

    const placeholderId = crypto.randomUUID()
    try {
      const userMessage: DialogMessage = {
        id: crypto.randomUUID(),
        dialog_id: dialogId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        token_count: null,
        citations: [],
      }
      const assistantPlaceholder: DialogMessage = {
        id: placeholderId,
        dialog_id: dialogId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        token_count: null,
        citations: [],
      }
      set((state) => ({ messages: [...state.messages, userMessage, assistantPlaceholder] }))

      const token = useAuthStore.getState().accessToken
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`/api/v1/dialogs/${dialogId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Failed to send message')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      let citations: Citation[] = []
      let sseBuffer = ''

      const processSSELine = (line: string) => {
        if (!line.startsWith('data: ')) return
        try {
          const data = JSON.parse(line.slice(6))
          if (data.error) {
            // Replace placeholder with error message, stop streaming
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === placeholderId
                  ? { ...m, content: `Ошибка: ${data.error}`, isStreaming: false }
                  : m
              ),
            }))
            return
          }
          if (data.chunk) {
            assistantContent += data.chunk
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === placeholderId ? { ...m, content: assistantContent } : m
              ),
            }))
          } else if (data.citations) {
            citations = (data.citations as SSECitation[]).map((c) => ({
              id: c.chunk_id,
              chunk_id: c.chunk_id,
              rank_position: 0,
              similarity_score: c.similarity_score,
              rerank_score: c.rerank_score,
              chunk_text: c.chunk_text,
              document_title: c.document_title,
              page_number: null,
              section_title: null,
            }))
          } else if (data.dialog_title) {
            set((state) => ({
              currentDialog: state.currentDialog
                ? { ...state.currentDialog, title: data.dialog_title }
                : state.currentDialog,
              dialogs: state.dialogs.map((d) =>
                d.id === dialogId ? { ...d, title: data.dialog_title } : d
              ),
            }))
          }
        } catch { /* skip malformed */ }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          sseBuffer += decoder.decode(value, { stream: true })
          const lines = sseBuffer.split('\n')
          sseBuffer = lines.pop() ?? ''  // keep incomplete last line in buffer

          for (const line of lines) {
            processSSELine(line)
          }
        }

        if (sseBuffer.trim()) {
          processSSELine(sseBuffer)
        }
      } finally {
        reader.releaseLock()
      }

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === placeholderId
            ? { ...m, content: assistantContent, citations: citations || [] }
            : m
        ),
      }))
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('Failed to stream message:', error)
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== placeholderId),
      }))
    } finally {
      set({ isStreaming: false, streamController: null })
    }
  },

  setMessages: (messages) => set({ messages }),
}))
