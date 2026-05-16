import { create } from 'zustand'
import { collectionsApi } from '../api/collections'
import { documentsApi } from '../api/documents'
import type { Collection, CollectionCreate, CollectionUpdate } from '../types/collection'
import type { Document } from '../types/document'

interface CollectionState {
  collections: Collection[]
  activeCollectionId: string | null
  documents: Document[]
  loading: boolean
  documentsLoading: boolean

  fetchCollections: () => Promise<void>
  createCollection: (data: CollectionCreate) => Promise<Collection>
  updateCollection: (id: string, data: CollectionUpdate) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  setActiveCollection: (id: string) => void

  fetchDocuments: (collectionId: string) => Promise<void>
  uploadDocument: (collectionId: string, file: File, description?: string, tags?: string[]) => Promise<void>
  moveDocument: (collectionId: string, documentId: string, targetCollectionId: string) => Promise<void>
  deleteDocument: (collectionId: string, documentId: string) => Promise<void>
  reset: () => void
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  activeCollectionId: null,
  documents: [],
  loading: false,
  documentsLoading: false,

  reset: () =>
    set({
      collections: [],
      activeCollectionId: null,
      documents: [],
      loading: false,
      documentsLoading: false,
    }),

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

  updateCollection: async (id, data) => {
    const updated = await collectionsApi.update(id, data)
    set(state => ({
      collections: state.collections.map(c => c.id === id ? updated : c),
    }))
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
    set({ documentsLoading: true, activeCollectionId: collectionId })
    try {
      const documents = await documentsApi.list(collectionId)
      if (get().activeCollectionId === collectionId) {
        set({ documents })
      }
    } finally {
      set({ documentsLoading: false })
    }
  },

  uploadDocument: async (collectionId, file, description, tags) => {
    await documentsApi.upload(collectionId, file, description, tags)
    await get().fetchDocuments(collectionId)
  },

  moveDocument: async (collectionId, documentId, targetCollectionId) => {
    await documentsApi.move(collectionId, documentId, targetCollectionId)
    await get().fetchDocuments(collectionId)
  },

  deleteDocument: async (collectionId, documentId) => {
    await documentsApi.delete(collectionId, documentId)
    set(state => ({
      documents: state.documents.filter(d => d.id !== documentId),
    }))
  },

}))
