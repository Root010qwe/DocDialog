import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FolderOpen, Trash2, Calendar, ChevronRight } from 'lucide-react'
import type { Collection } from '../../types/collection'

interface Props {
  collection: Collection
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Deterministic color per collection id
const GRADIENTS = [
  'from-brand-500 to-accent-violet',
  'from-accent-emerald to-brand-500',
  'from-accent-amber to-accent-rose',
  'from-accent-violet to-brand-600',
  'from-brand-400 to-accent-emerald',
]

function getGradient(id: string) {
  const idx = id.charCodeAt(0) % GRADIENTS.length
  return GRADIENTS[idx]
}

export default function CollectionCard({ collection, onDelete }: Props) {
  const navigate = useNavigate()
  const grad = getGradient(collection.id)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Удалить коллекцию «${collection.name}»? Все документы и история диалогов будут удалены. Это действие необратимо.`)) {
      onDelete(collection.id)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow cursor-pointer overflow-hidden"
      onClick={() => navigate(`/collections/${collection.id}`)}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-400 hover:text-accent-rose hover:bg-red-50 transition-all"
            onClick={handleDelete}
            title="Удалить коллекцию"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3 className="font-semibold text-surface-900 text-base leading-tight mb-1 line-clamp-1">
          {collection.name}
        </h3>
        {collection.description ? (
          <p className="text-sm text-surface-500 line-clamp-2 mb-3">{collection.description}</p>
        ) : (
          <p className="text-sm text-surface-400 italic mb-3">Без описания</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-surface-100">
          <span className="flex items-center gap-1.5 text-xs text-surface-400">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(collection.created_at)}
          </span>
          <span className="flex items-center gap-1 text-xs text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Открыть <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </motion.div>
  )
}
