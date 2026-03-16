import { useNavigate } from 'react-router-dom'
import type { Collection } from '../../types/collection'
import styles from './CollectionCard.module.css'

interface Props {
  collection: Collection
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CollectionCard({ collection, onDelete }: Props) {
  const navigate = useNavigate()

  return (
    <div className={styles.card} onClick={() => navigate(`/collections/${collection.id}`)}>
      <div className={styles.icon}>📁</div>
      <div className={styles.body}>
        <h3 className={styles.name}>{collection.name}</h3>
        {collection.description && (
          <p className={styles.desc}>{collection.description}</p>
        )}
        <p className={styles.date}>Создана {formatDate(collection.created_at)}</p>
      </div>
      <button
        className={styles.deleteBtn}
        onClick={e => { e.stopPropagation(); onDelete(collection.id) }}
        title="Удалить коллекцию"
      >
        ✕
      </button>
    </div>
  )
}
