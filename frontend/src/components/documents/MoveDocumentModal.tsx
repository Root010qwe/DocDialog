import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MoveRight, Loader2 } from 'lucide-react'
import { useCollectionStore } from '../../store/collectionStore'
import type { Document } from '../../types/document'

interface Props {
  document: Document
  currentCollectionId: string
  onMove: (targetCollectionId: string) => Promise<void>
  onClose: () => void
}

export default function MoveDocumentModal({ document, currentCollectionId, onMove, onClose }: Props) {
  const { collections } = useCollectionStore()
  const [selectedId, setSelectedId] = useState('')
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState('')

  const targets = collections.filter(c => c.id !== currentCollectionId)

  const handleMove = async () => {
    if (!selectedId) return
    setError('')
    setMoving(true)
    try {
      await onMove(selectedId)
    } catch {
      setError('Ошибка при перемещении. Попробуйте снова.')
    } finally {
      setMoving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md z-10"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center">
              <MoveRight className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-900">Переместить документ</h2>
              <p className="text-xs text-surface-500 truncate max-w-xs">{document.title}</p>
            </div>
          </div>

          {targets.length === 0 ? (
            <p className="text-sm text-surface-500 py-4 text-center">
              Нет других коллекций для перемещения.
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-surface-600">Выберите коллекцию назначения:</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {targets.map(col => (
                  <label
                    key={col.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${
                      selectedId === col.id
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="target"
                      value={col.id}
                      checked={selectedId === col.id}
                      onChange={() => setSelectedId(col.id)}
                      className="accent-brand-500"
                    />
                    <span className="text-sm font-medium text-surface-800">{col.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-accent-rose mb-3">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm text-surface-600 bg-surface-100 hover:bg-surface-200 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleMove}
              disabled={!selectedId || moving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white gradient-brand disabled:opacity-50 hover:opacity-90 transition-all"
            >
              {moving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Переместить
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
