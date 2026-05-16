import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogOut, FolderOpen, FileText, Sparkles, Settings } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useCollectionStore } from '../store/collectionStore'
import CollectionCard from '../components/collections/CollectionCard'
import CollectionForm from '../components/collections/CollectionForm'

const SKELETON_COUNT = 3

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
      <div className="h-1.5 w-full shimmer" />
      <div className="p-5 space-y-3">
        <div className="w-10 h-10 rounded-xl shimmer" />
        <div className="h-4 w-2/3 rounded-lg shimmer" />
        <div className="h-3 w-full rounded-lg shimmer" />
        <div className="h-3 w-4/5 rounded-lg shimmer" />
      </div>
    </div>
  )
}

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
    <div className="min-h-screen gradient-mesh">
      <header className="glass sticky top-0 z-30 border-b border-white/60">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-surface-900 text-base">DocDialog</span>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:block text-sm text-surface-500">
                {user.full_name || user.email}
              </span>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Настройки</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Коллекции</h1>
            <p className="text-sm text-surface-500 mt-1">
              {loading ? 'Загрузка...' : `${collections.length} коллекци${collections.length === 1 ? 'я' : collections.length < 5 ? 'и' : 'й'}`}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 gradient-brand text-white text-sm font-semibold rounded-xl shadow-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Создать коллекцию
          </motion.button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center shadow-md mb-4">
              <FolderOpen className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-surface-800 mb-2">Коллекций пока нет</h3>
            <p className="text-sm text-surface-500 max-w-xs mb-6">
              Создайте коллекцию, загрузите документы и начните диалог с ними
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 gradient-brand text-white text-sm font-semibold rounded-xl shadow-sm hover:opacity-90 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Создать первую коллекцию
            </button>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {collections.map(c => (
                <CollectionCard key={c.id} collection={c} onDelete={deleteCollection} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {showForm && (
        <CollectionForm onSubmit={createCollection} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
