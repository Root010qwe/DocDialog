import { useRef, useState } from 'react'
import styles from './DocumentUpload.module.css'

interface Props {
  onUpload: (file: File) => Promise<void>
  disabled?: boolean
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md,.html,.htm'

export default function DocumentUpload({ onUpload, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setUploading(true)
    try {
      await onUpload(file)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(msg ?? 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div>
      <div
        className={`${styles.zone} ${dragging ? styles.dragging : ''} ${disabled || uploading ? styles.disabled : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} onChange={handleChange} hidden />
        <div className={styles.icon}>📄</div>
        {uploading ? (
          <p className={styles.text}>Загрузка...</p>
        ) : (
          <>
            <p className={styles.text}>Перетащите файл или нажмите для выбора</p>
            <p className={styles.hint}>PDF, DOCX, TXT, MD, HTML · до 50 МБ</p>
          </>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
