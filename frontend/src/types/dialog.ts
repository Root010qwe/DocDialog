export type MessageRole = 'user' | 'assistant' | 'system'

export interface Citation {
  id: string
  chunk_id: string
  rank_position: number
  similarity_score: number
  rerank_score: number | null
  chunk_text: string
  document_title: string
  page_number: number | null
  section_title: string | null
}

export interface DialogMessage {
  id: string
  dialog_id: string
  role: MessageRole
  content: string
  created_at: string
  token_count: number | null
  citations?: Citation[]
}

export interface Dialog {
  id: string
  collection_id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
  messages?: DialogMessage[]
}
