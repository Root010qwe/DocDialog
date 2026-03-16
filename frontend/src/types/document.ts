export type DocumentStatus = 'pending' | 'indexing' | 'indexed' | 'error'

export interface Document {
  id: string
  document_file_id: string
  collection_id: string
  title: string
  language: string | null
  status: DocumentStatus
  error_message: string | null
  chunk_count: number
  indexed_at: string | null
}

export interface DocumentUploadResponse {
  document_file_id: string
  document_id: string
  status: DocumentStatus
  message: string
}

export interface DocumentFile {
  id: string
  collection_id: string
  original_filename: string
  content_type: string
  file_size_bytes: number
  uploaded_at: string
  document: Document | null
}
