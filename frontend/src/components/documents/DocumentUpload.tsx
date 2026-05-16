import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  onUpload: (file: File, description?: string, tags?: string[]) => Promise<void>
  disabled?: boolean
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md,.html,.htm'

export default function DocumentUpload({ onUpload, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setFileName(file.name)
    setUploading(true)
    try {
      const tags = tagsInput
        ? tagsInput.split(',').map(t => t.trim()).filter(Boolean)
        : undefined
      await onUpload(file, description || undefined, tags)
      setFileName('')
      setDescription('')
      setTagsInput('')
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

  const isDisabled = disabled || uploading

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="block text-xs font-medium text-surface-600 mb-1">
            Описание <span className="text-surface-400 font-normal">(необязательно)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={isDisabled}
            rows={2}
            placeholder="Краткое описание документа..."
            className="w-full text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 resize-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-600 mb-1">
            Теги <span className="text-surface-400 font-normal">(через запятую)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            disabled={isDisabled}
            placeholder="договор, отчёт, 2026..."
            className="w-full text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 disabled:opacity-50"
          />
        </div>
      </div>

      <motion.div
        animate={dragging ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.15 }}
        className={clsx(
          'relative rounded-2xl border-2 border-dashed transition-all cursor-pointer',
          'flex flex-col items-center justify-center gap-3 p-8',
          dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-surface-300 bg-surface-50 hover:border-brand-400 hover:bg-surface-100',
          isDisabled && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isDisabled && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} onChange={handleChange} hidden />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 gradient-brand rounded-2xl flex items-center justify-center shadow-md">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-surface-700">Загружаю файл...</p>
                {fileName && <p className="text-xs text-surface-500 mt-0.5 max-w-xs truncate">{fileName}</p>}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className={clsx(
                'w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all',
                dragging ? 'gradient-brand' : 'bg-surface-200'
              )}>
                <UploadCloud className={clsx('w-6 h-6', dragging ? 'text-white' : 'text-surface-500')} />
              </div>
              <div>
                <p className="text-sm font-medium text-surface-700">
                  {dragging ? 'Отпустите файл' : 'Перетащите файл или нажмите для выбора'}
                </p>
                <p className="text-xs text-surface-400 mt-1">PDF, DOCX, TXT, MD, HTML · до 50 МБ</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-accent-rose bg-red-50 border border-red-100 rounded-xl px-3 py-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}
    </div>
  )
}
