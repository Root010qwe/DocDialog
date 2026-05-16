import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Trash2, Hash, Tag, MoveRight } from 'lucide-react'
import type { Document } from '../../types/document'
import DocumentStatusBadge from './DocumentStatusBadge'
import MoveDocumentModal from './MoveDocumentModal'

interface Props {
  documents: Document[]
  collectionId: string
  onDelete: (docId: string) => void
  onMove?: (docId: string, targetCollectionId: string) => Promise<void>
  canManage?: boolean
}

export default function DocumentList({ documents, collectionId, onDelete, onMove, canManage = true }: Props) {
  const [movingDoc, setMovingDoc] = useState<Document | null>(null)

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <FileText className="w-10 h-10 text-surface-300 mb-3" />
        <p className="text-sm text-surface-500">Документов пока нет. Загрузите первый файл выше.</p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {documents.map((doc, i) => (
            <motion.li
              key={doc.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: i * 0.04 }}
              className="group flex items-center gap-3 bg-white rounded-xl border border-surface-200 px-4 py-3 hover:border-surface-300 hover:shadow-sm transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-brand-600" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate">{doc.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {doc.chunk_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-surface-400">
                      <Hash className="w-3 h-3" />
                      {doc.chunk_count} фрагментов
                    </span>
                  )}
                  {doc.tags && doc.tags.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-brand-500">
                      <Tag className="w-3 h-3" />
                      {doc.tags.join(', ')}
                    </span>
                  )}
                  {doc.description && (
                    <span className="text-xs text-surface-500 truncate max-w-xs" title={doc.description}>
                      {doc.description.slice(0, 60)}{doc.description.length > 60 ? '…' : ''}
                    </span>
                  )}
                  {doc.error_message && (
                    <span className="text-xs text-accent-rose truncate max-w-xs" title={doc.error_message}>
                      {doc.error_message.slice(0, 60)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <DocumentStatusBadge status={doc.status} progress={doc.indexing_progress} />
                {canManage && onMove && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                    onClick={() => setMovingDoc(doc)}
                    title="Переместить в другую коллекцию"
                  >
                    <MoveRight className="w-4 h-4" />
                  </button>
                )}
                {canManage && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-accent-rose hover:bg-red-50 transition-all"
                    onClick={() => {
                      if (!window.confirm(`Удалить документ «${doc.title}»? Он будет удалён из индекса.`)) return
                      onDelete(doc.id)
                    }}
                    title="Удалить документ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {movingDoc && onMove && (
        <MoveDocumentModal
          document={movingDoc}
          currentCollectionId={collectionId}
          onMove={async (targetId) => {
            await onMove(movingDoc.id, targetId)
            setMovingDoc(null)
          }}
          onClose={() => setMovingDoc(null)}
        />
      )}
    </>
  )
}
