import apiClient from './client'
import type { Collection, CollectionCreate, CollectionUpdate } from '../types/collection'

export const collectionsApi = {
  list: () =>
    apiClient.get<Collection[]>('/collections').then(r => r.data),

  get: (id: string) =>
    apiClient.get<Collection>(`/collections/${id}`).then(r => r.data),

  create: (data: CollectionCreate) =>
    apiClient.post<Collection>('/collections', data).then(r => r.data),

  update: (id: string, data: CollectionUpdate) =>
    apiClient.patch<Collection>(`/collections/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/collections/${id}`),
}
