import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCollectionStore } from '../store/collectionStore'
import DocumentUpload from '../components/documents/DocumentUpload'
import DocumentList from '../components/documents/DocumentList'
import styles from './CollectionDetailPage.module.css'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    collections,
    documents,
    documentsLoading,
    fetchCollections,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  } = useCollectionStore()

  const collection = collections.find(c => c.id === id)

  useEffect(() => {
    if (collections.length === 0) fetchCollections()
    if (id) fetchDocuments(id)
  }, [id]) // eslint-disable-line

  const handleUpload = async (file: File) => {
    if (!id) return
    await uploadDocument(id, file)
  }

  const handleDelete = async (docId: string) => {
    if (!id) return
    await deleteDocument(id, docId)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/collections')}>
          ← Коллекции
        </button>
        <h1 className={styles.title}>{collection?.name ?? 'Коллекция'}</h1>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Загрузить документ</h2>
          <DocumentUpload onUpload={handleUpload} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Документы
            {documents.length > 0 && (
              <span className={styles.count}>{documents.length}</span>
            )}
          </h2>
          {documentsLoading ? (
            <p className={styles.loading}>Загрузка...</p>
          ) : (
            <DocumentList
              documents={documents}
              collectionId={id ?? ''}
              onDelete={handleDelete}
            />
          )}
        </section>
      </main>
    </div>
  )
}
