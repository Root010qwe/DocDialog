import apiClient from './client'
import type { Document, DocumentUploadResponse } from '../types/document'

export const documentsApi = {
  list: (collectionId: string) =>
    apiClient
      .get<Document[]>(`/collections/${collectionId}/documents`)
      .then(r => r.data),

  get: (collectionId: string, documentId: string) =>
    apiClient
      .get<Document>(`/collections/${collectionId}/documents/${documentId}`)
      .then(r => r.data),

  upload: (
    collectionId: string,
    file: File,
    description?: string,
    tags?: string[],
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (description) form.append('description', description)
    if (tags && tags.length > 0) form.append('tags', tags.join(','))
    return apiClient
      .post<DocumentUploadResponse>(
        `/collections/${collectionId}/documents`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then(r => r.data)
  },

  move: (collectionId: string, documentId: string, targetCollectionId: string) =>
    apiClient.patch(
      `/collections/${collectionId}/documents/${documentId}/move`,
      { target_collection_id: targetCollectionId },
    ),

  delete: (collectionId: string, documentId: string) =>
    apiClient.delete(`/collections/${collectionId}/documents/${documentId}`),
}
