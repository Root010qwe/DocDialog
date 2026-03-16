import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCollectionStore } from '../store/collectionStore'
import CollectionCard from '../components/collections/CollectionCard'
import CollectionForm from '../components/collections/CollectionForm'
import styles from './CollectionsPage.module.css'

export default function CollectionsPage() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const { collections, loading, fetchCollections, createCollection, deleteCollection } =
    useCollectionStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchCollections() }, []) // eslint-disable-line

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.logo}>DocDialog</h1>
        <div className={styles.userArea}>
          <span className={styles.email}>{user?.full_name}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Выйти</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Мои коллекции</h2>
          <button className={styles.createBtn} onClick={() => setShowForm(true)}>
            + Создать коллекцию
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : collections.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📂</div>
            <p>У вас пока нет коллекций.</p>
            <button className={styles.createBtnOutline} onClick={() => setShowForm(true)}>
              Создать первую коллекцию
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {collections.map(c => (
              <CollectionCard
                key={c.id}
                collection={c}
                onDelete={deleteCollection}
              />
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <CollectionForm
          onSubmit={createCollection}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
