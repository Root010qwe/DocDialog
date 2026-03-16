import { useEffect } from 'react'
import type { Document } from '../../types/document'
import DocumentStatusBadge from './DocumentStatusBadge'
import styles from './DocumentList.module.css'
import { useCollectionStore } from '../../store/collectionStore'

interface Props {
  documents: Document[]
  collectionId: string
  onDelete: (docId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentList({ documents, collectionId, onDelete }: Props) {
  const pollDocumentStatus = useCollectionStore(s => s.pollDocumentStatus)

  // Start polling for documents that are pending/indexing
  useEffect(() => {
    documents.forEach(doc => {
      if (doc.status === 'pending' || doc.status === 'indexing') {
        pollDocumentStatus(collectionId, doc.id)
      }
    })
  }, [documents.map(d => d.id).join(',')]) // eslint-disable-line

  if (documents.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Документов пока нет. Загрузите первый файл выше.</p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {documents.map(doc => (
        <li key={doc.id} className={styles.item}>
          <div className={styles.info}>
            <span className={styles.title}>{doc.title}</span>
            {doc.chunk_count > 0 && (
              <span className={styles.meta}>{doc.chunk_count} фрагментов</span>
            )}
            {doc.error_message && (
              <span className={styles.error} title={doc.error_message}>
                {doc.error_message.slice(0, 80)}
              </span>
            )}
          </div>
          <div className={styles.right}>
            <DocumentStatusBadge status={doc.status} />
            <button
              className={styles.deleteBtn}
              onClick={() => onDelete(doc.id)}
              title="Удалить"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
