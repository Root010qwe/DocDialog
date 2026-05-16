import apiClient from './client'
import type { Dialog, DialogMessage } from '../types/dialog'

export const dialogsApi = {
  create: (collectionId: string) =>
    apiClient.post<Dialog>('/dialogs', { collection_id: collectionId }).then(r => r.data),

  list: () =>
    apiClient.get<Dialog[]>('/dialogs').then(r => r.data),

  get: (dialogId: string) =>
    apiClient.get<Dialog>(`/dialogs/${dialogId}`).then(r => r.data),

  listMessages: (dialogId: string) =>
    apiClient.get<DialogMessage[]>(`/dialogs/${dialogId}/messages`).then(r => r.data),

  rateMessage: (
    dialogId: string,
    messageId: string,
    rating: 'positive' | 'negative' | null,
  ) =>
    apiClient
      .patch<DialogMessage>(`/dialogs/${dialogId}/messages/${messageId}/rating`, { rating })
      .then(r => r.data),
}
