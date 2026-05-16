import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, UserPlus, Trash2, Loader2, ChevronDown } from 'lucide-react'
import { rolesApi, type Member } from '../../api/roles'

interface Props {
  collectionId: string
  collectionName: string
  currentUserId: string
  onClose: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  editor: 'Редактор',
  viewer: 'Наблюдатель',
}

export default function ShareCollectionModal({
  collectionId,
  collectionName,
  currentUserId,
  onClose,
}: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    rolesApi.listMembers(collectionId).then(setMembers).finally(() => setLoading(false))
  }, [collectionId])

  const handleAdd = async () => {
    if (!email.trim()) return
    setError('')
    setAdding(true)
    try {
      const member = await rolesApi.addMember(collectionId, email.trim(), role)
      setMembers(prev => [...prev, member])
      setEmail('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Ошибка при добавлении пользователя')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await rolesApi.removeMember(collectionId, userId)
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch { /* ignore */ }
  }

  const handleRoleChange = async (userId: string, newRole: 'editor' | 'viewer' | 'owner') => {
    try {
      const updated = await rolesApi.updateMember(collectionId, userId, newRole)
      setMembers(prev => prev.map(m => m.user_id === userId ? updated : m))
    } catch { /* ignore */ }
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
          className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg z-10"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-900">Участники коллекции</h2>
              <p className="text-xs text-surface-500 truncate max-w-xs">{collectionName}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="email пользователя"
              className="flex-1 text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <div className="relative">
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
                className="appearance-none text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 pr-7 text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="viewer">Наблюдатель</option>
                <option value="editor">Редактор</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
            </div>
            <button
              onClick={handleAdd}
              disabled={!email.trim() || adding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white gradient-brand disabled:opacity-50 hover:opacity-90 transition-all"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            </button>
          </div>

          {error && <p className="text-xs text-accent-rose mb-3">{error}</p>}

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-surface-500 py-4 text-center">
                Нет участников. Добавьте пользователя выше.
              </p>
            ) : (
              members.map(member => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-50 border border-surface-100"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-brand-600">
                      {(member.full_name || member.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-800 truncate">
                      {member.full_name || member.email}
                    </p>
                    <p className="text-[11px] text-surface-500 truncate">{member.email}</p>
                  </div>
                  {member.user_id !== currentUserId && member.role !== 'owner' ? (
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={e => handleRoleChange(member.user_id, e.target.value as 'editor' | 'viewer' | 'owner')}
                          className="appearance-none text-xs rounded-lg border border-surface-200 bg-white px-2 py-1 pr-5 text-surface-700 focus:outline-none"
                        >
                          <option value="viewer">Наблюдатель</option>
                          <option value="editor">Редактор</option>
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
                      </div>
                      <button
                        onClick={() => handleRemove(member.user_id)}
                        className="p-1 rounded-lg text-surface-400 hover:text-accent-rose hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
