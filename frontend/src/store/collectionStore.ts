import { create } from 'zustand'
import { collectionsApi } from '../api/collections'
import { documentsApi } from '../api/documents'
import type { Collection, CollectionCreate } from '../types/collection'
import type { Document } from '../types/document'

interface CollectionState {
  collections: Collection[]
  activeCollectionId: string | null
  documents: Document[]
  loading: boolean
  documentsLoading: boolean

  fetchCollections: () => Promise<void>
  createCollection: (data: CollectionCreate) => Promise<Collection>
  deleteCollection: (id: string) => Promise<void>
  setActiveCollection: (id: string) => void

  fetchDocuments: (collectionId: string) => Promise<void>
  uploadDocument: (collectionId: string, file: File) => Promise<void>
  deleteDocument: (collectionId: string, documentId: string) => Promise<void>
  pollDocumentStatus: (collectionId: string, documentId: string) => void
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  activeCollectionId: null,
  documents: [],
  loading: false,
  documentsLoading: false,

  fetchCollections: async () => {
    set({ loading: true })
    try {
      const collections = await collectionsApi.list()
      set({ collections })
    } finally {
      set({ loading: false })
    }
  },

  createCollection: async (data) => {
    const collection = await collectionsApi.create(data)
    set(state => ({ collections: [collection, ...state.collections] }))
    return collection
  },

  deleteCollection: async (id) => {
    await collectionsApi.delete(id)
    set(state => ({
      collections: state.collections.filter(c => c.id !== id),
      activeCollectionId: state.activeCollectionId === id ? null : state.activeCollectionId,
    }))
  },

  setActiveCollection: (id) => set({ activeCollectionId: id }),

  fetchDocuments: async (collectionId) => {
    set({ documentsLoading: true })
    try {
      const documents = await documentsApi.list(collectionId)
      set({ documents })
    } finally {
      set({ documentsLoading: false })
    }
  },

  uploadDocument: async (collectionId, file) => {
    const response = await documentsApi.upload(collectionId, file)
    // Refresh document list
    await get().fetchDocuments(collectionId)
  },

  deleteDocument: async (collectionId, documentId) => {
    await documentsApi.delete(collectionId, documentId)
    set(state => ({
      documents: state.documents.filter(d => d.id !== documentId),
    }))
  },

  pollDocumentStatus: (collectionId, documentId) => {
    const interval = setInterval(async () => {
      try {
        const doc = await documentsApi.get(collectionId, documentId)
        set(state => ({
          documents: state.documents.map(d => d.id === documentId ? doc : d),
        }))
        if (doc.status === 'indexed' || doc.status === 'error') {
          clearInterval(interval)
        }
      } catch {
        clearInterval(interval)
      }
    }, 3000)
  },
}))
