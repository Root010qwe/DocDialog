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

  upload: (collectionId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<DocumentUploadResponse>(
        `/collections/${collectionId}/documents`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then(r => r.data)
  },

  delete: (collectionId: string, documentId: string) =>
    apiClient.delete(`/collections/${collectionId}/documents/${documentId}`),
}
