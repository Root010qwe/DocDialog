import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Pencil, Loader2 } from 'lucide-react'
import type { Collection, CollectionUpdate } from '../../types/collection'

interface Props {
  collection: Collection
  onSave: (data: CollectionUpdate) => Promise<void>
  onClose: () => void
}

export default function CollectionEditModal({ collection, onSave, onClose }: Props) {
  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(msg ?? 'Ошибка сохранения')
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white rounded-2xl shadow-[var(--shadow-modal)] border border-surface-200 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
                <Pencil className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-semibold text-surface-900">Редактировать коллекцию</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Название <span className="text-accent-rose">*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 text-sm transition-all focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Описание <span className="text-surface-400 font-normal">(необязательно)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 text-sm resize-none transition-all focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/10"
              />
            </div>

            {error && (
              <p className="text-sm text-accent-rose bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-all"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
