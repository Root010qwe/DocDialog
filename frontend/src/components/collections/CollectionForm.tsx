import { useState } from 'react'
import styles from './CollectionForm.module.css'
import type { CollectionCreate } from '../../types/collection'

interface Props {
  onSubmit: (data: CollectionCreate) => Promise<void>
  onClose: () => void
}

export default function CollectionForm({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined })
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(msg ?? 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Новая коллекция</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Название *
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Дипломная работа"
              required
              autoFocus
            />
          </label>
          <label className={styles.label}>
            Описание
            <textarea
              className={styles.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание коллекции..."
              rows={3}
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className={styles.submit} disabled={loading || !name.trim()}>
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
