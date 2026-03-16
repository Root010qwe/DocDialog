export interface Collection {
  id: string
  name: string
  description: string | null
  owner_id: string
  qdrant_collection_name: string
  created_at: string
  updated_at: string
}

export interface CollectionCreate {
  name: string
  description?: string
}

export interface CollectionUpdate {
  name?: string
  description?: string
}
