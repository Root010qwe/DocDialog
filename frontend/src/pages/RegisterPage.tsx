import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, UserPlus, FileText, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setTokens = useAuthStore((s) => s.setTokens)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setConfirmError('')

    if (password !== confirmPassword) {
      setConfirmError('Пароли не совпадают')
      return
    }

    setLoading(true)
    try {
      await authApi.register({ email, password, full_name: fullName })
      const tokens = await authApi.login({ email, password })
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await authApi.getMe()
      setAuth(user, tokens.access_token, tokens.refresh_token)
      navigate('/collections')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setError(msg ?? 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-accent-violet/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative"
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.12)] border border-white/80 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-surface-900 leading-none">DocDialog</h1>
              <p className="text-xs text-surface-400 mt-0.5">RAG-система диалога с документами</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-surface-900 mb-1">Создать аккаунт</h2>
          <p className="text-sm text-surface-500 mb-6">Начните анализировать документы уже сейчас</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Полное имя</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Иван Иванов"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 text-sm transition-all focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 text-sm transition-all focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Минимум 8 символов"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 text-sm transition-all focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  tabIndex={-1}
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Подтвердите пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError('') }}
                  required
                  placeholder="Повторите пароль"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border bg-surface-50 text-surface-900 placeholder:text-surface-400 text-sm transition-all focus:outline-none focus:bg-white focus:ring-3 ${
                    confirmError
                      ? 'border-accent-rose focus:border-accent-rose focus:ring-red-500/10'
                      : 'border-surface-200 focus:border-brand-500 focus:ring-brand-500/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  tabIndex={-1}
                  title={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmError && (
                <p className="text-xs text-accent-rose mt-1.5 pl-1">{confirmError}</p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-accent-rose bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-rose flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 gradient-brand text-white text-sm font-semibold rounded-xl shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex gap-1">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
                </span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Зарегистрироваться
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-surface-500 text-center mt-6">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700 transition-colors">
              Войти
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
