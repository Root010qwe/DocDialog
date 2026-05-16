import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Settings, Loader2, Check, AlertCircle, RefreshCw,
  Wifi, WifiOff, Key, Plus, Trash2, Star, Eye, EyeOff, ChevronDown,
} from 'lucide-react'
import apiClient from '../api/client'

interface LLMSettings {
  provider: string
  model_name: string
  max_tokens: number
  temperature: number
}

interface OllamaModels {
  connected: boolean
  models: string[]
  ollama_url?: string
  error?: string
}

interface TestResult {
  ok: boolean
  provider: string
  model: string
  error?: string
}

interface APIKeyItem {
  id: string
  provider: string
  label: string
  masked_key: string
  is_active: boolean
  created_at: string
}

const RESPONSE_LENGTH_PRESETS = [
  { label: 'Короткий', hint: '~200 слов', value: 512 },
  { label: 'Нормальный', hint: '~500 слов', value: 2048 },
  { label: 'Подробный', hint: '~1500 слов', value: 4096 },
]

const STYLE_PRESETS = [
  { label: 'Точный', hint: 'Факты без фантазий', value: 0.0 },
  { label: 'Сбалансированный', hint: 'Оптимально для большинства задач', value: 0.3 },
  { label: 'Творческий', hint: 'Свободный стиль изложения', value: 0.7 },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [provider, setProvider] = useState('ollama')
  const [modelName, setModelName] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [maxTokens, setMaxTokens] = useState(2048)
  const [temperature, setTemperature] = useState(0.3)

  const [ollamaData, setOllamaData] = useState<OllamaModels | null>(null)
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)

  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [showKeyValue, setShowKeyValue] = useState(false)
  const [addingKey, setAddingKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null)
  const [keyTestResults, setKeyTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)
  const [activatingKeyId, setActivatingKeyId] = useState<string | null>(null)

  useEffect(() => {
    apiClient.get<LLMSettings>('/settings/llm')
      .then(r => {
        const s = r.data
        setLlmSettings(s)
        setProvider(s.provider)
        setModelName(s.model_name)
        setMaxTokens(s.max_tokens)
        setTemperature(s.temperature)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchApiKeys = () => {
    setKeysLoading(true)
    apiClient.get<APIKeyItem[]>('/settings/api-keys')
      .then(r => setApiKeys(r.data))
      .catch(() => {})
      .finally(() => setKeysLoading(false))
  }

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchOllamaModels = () => {
    setOllamaLoading(true)
    setTestResult(null)
    apiClient.get<OllamaModels>('/settings/ollama/models')
      .then(r => setOllamaData(r.data))
      .catch(() => setOllamaData({ connected: false, models: [], error: 'Не удалось подключиться' }))
      .finally(() => setOllamaLoading(false))
  }

  useEffect(() => {
    if (provider === 'ollama') fetchOllamaModels()
  }, [provider]) // eslint-disable-line

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await apiClient.get<TestResult>('/settings/llm/test')
      setTestResult(r.data)
    } catch {
      setTestResult({ ok: false, provider, model: modelName, error: 'Ошибка запроса' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    setTestResult(null)
    try {
      const model = customModel.trim() || modelName
      if (!model) { setError('Выберите или введите модель'); setSaving(false); return }
      await apiClient.patch('/settings/llm', { provider, model_name: model, max_tokens: maxTokens, temperature })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const handleAddKey = async () => {
    setKeyError('')
    if (!newKeyValue.trim()) { setKeyError('Введите API ключ'); return }
    setAddingKey(true)
    try {
      await apiClient.post('/settings/api-keys', {
        provider: 'openai',
        label: newKeyLabel.trim() || 'OpenAI ключ',
        key_value: newKeyValue.trim(),
        activate: true,
      })
      setNewKeyLabel('')
      setNewKeyValue('')
      setShowAddKey(false)
      fetchApiKeys()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setKeyError(msg ?? 'Ошибка при сохранении')
    } finally {
      setAddingKey(false)
    }
  }

  const handleActivateKey = async (keyId: string) => {
    setActivatingKeyId(keyId)
    try {
      await apiClient.post(`/settings/api-keys/${keyId}/activate`, {})
      fetchApiKeys()
    } catch { /* ignore */ }
    finally { setActivatingKeyId(null) }
  }

  const handleDeleteKey = async (keyId: string) => {
    setDeletingKeyId(keyId)
    try {
      await apiClient.delete(`/settings/api-keys/${keyId}`)
      setApiKeys(prev => prev.filter(k => k.id !== keyId))
      setKeyTestResults(prev => { const n = { ...prev }; delete n[keyId]; return n })
    } catch { /* ignore */ }
    finally { setDeletingKeyId(null) }
  }

  const handleTestKey = async (keyId: string) => {
    setTestingKeyId(keyId)
    setKeyTestResults(prev => { const n = { ...prev }; delete n[keyId]; return n })
    try {
      const r = await apiClient.get<{ ok: boolean; error?: string }>(`/settings/api-keys/${keyId}/test`)
      setKeyTestResults(prev => ({ ...prev, [keyId]: r.data }))
    } catch {
      setKeyTestResults(prev => ({ ...prev, [keyId]: { ok: false, error: 'Ошибка запроса' } }))
    } finally {
      setTestingKeyId(null)
    }
  }

  const activeModel = customModel.trim() || modelName
  const lengthPreset = RESPONSE_LENGTH_PRESETS.find(p => p.value === maxTokens)
  const stylePreset = STYLE_PRESETS.find(p => Math.abs(p.value - temperature) < 0.05)
  const openaiKeys = apiKeys.filter(k => k.provider === 'openai')

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50/30">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-surface-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <motion.button
            whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/collections')}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Коллекции
          </motion.button>
          <div className="w-px h-4 bg-surface-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 gradient-brand rounded-md flex items-center justify-center">
              <Settings className="w-3 h-3 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-surface-900">Настройки ИИ</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-surface-200 p-6 flex items-center gap-2 text-sm text-surface-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка настроек...
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
              <h2 className="text-sm font-semibold text-surface-800 mb-3">Тип ИИ</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'ollama', label: 'Локальный ИИ', hint: 'Ollama — работает без интернета' },
                  { id: 'openai', label: 'Внешний API', hint: 'OpenAI и совместимые сервисы' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setProvider(p.id); setModelName(''); setCustomModel(''); setTestResult(null) }}
                    className={`px-4 py-3 rounded-xl text-left border transition-all ${
                      provider === p.id
                        ? 'gradient-brand text-white border-transparent'
                        : 'text-surface-600 bg-surface-50 border-surface-200 hover:border-surface-300'
                    }`}
                  >
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className={`text-xs mt-0.5 ${provider === p.id ? 'text-white/70' : 'text-surface-400'}`}>
                      {p.hint}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {provider === 'ollama' && (
              <div className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-surface-800">Выбор модели</h2>
                  <button
                    onClick={fetchOllamaModels}
                    disabled={ollamaLoading}
                    className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ollamaLoading ? 'animate-spin' : ''}`} />
                    Обновить
                  </button>
                </div>

                {ollamaLoading ? (
                  <div className="flex items-center gap-2 text-sm text-surface-400 mb-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Поиск установленных моделей...
                  </div>
                ) : ollamaData ? (
                  <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${
                    ollamaData.connected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {ollamaData.connected
                      ? <Wifi className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      : <WifiOff className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      {ollamaData.connected
                        ? <>
                            <span className="font-medium">Ollama подключена</span>
                            {' — '}найдено моделей: {ollamaData.models.length}
                            {ollamaData.ollama_url && (
                              <span className="block text-emerald-600/70 mt-0.5 font-mono">{ollamaData.ollama_url}</span>
                            )}
                          </>
                        : <>
                            <span className="font-medium">Ollama недоступна</span>
                            <span className="block mt-0.5">
                              Запустите: <code className="bg-red-100 px-1 rounded font-mono">brew services start ollama</code>
                            </span>
                          </>
                      }
                    </div>
                  </div>
                ) : null}

                {ollamaData?.connected && ollamaData.models.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {ollamaData.models.map(m => (
                      <label
                        key={m}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${
                          modelName === m && !customModel
                            ? 'border-brand-400 bg-brand-50'
                            : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                        }`}
                      >
                        <input
                          type="radio" name="model"
                          checked={modelName === m && !customModel}
                          onChange={() => { setModelName(m); setCustomModel('') }}
                          className="accent-brand-500"
                        />
                        <span className="text-sm text-surface-800 font-medium">{m}</span>
                      </label>
                    ))}
                  </div>
                ) : ollamaData?.connected && ollamaData.models.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800">
                    <p className="font-medium mb-1">Нет установленных моделей</p>
                    <p>Установите модель в терминале:</p>
                    <code className="block mt-1 bg-amber-100 rounded px-2 py-1 font-mono">ollama pull qwen2.5:7b</code>
                    <p className="mt-1 text-amber-700/70">Рекомендуется: qwen2.5:7b, qwen2.5:3b</p>
                  </div>
                ) : null}

                <div className={`px-3 py-2.5 rounded-xl border transition-all ${
                  customModel ? 'border-brand-400 bg-brand-50' : 'border-surface-200 bg-surface-50'
                }`}>
                  <label className="flex items-center gap-3 cursor-pointer mb-1.5">
                    <input type="radio" name="model" checked={!!customModel} onChange={() => {}} className="accent-brand-500" />
                    <span className="text-sm text-surface-600">Ввести название вручную</span>
                  </label>
                  <input
                    type="text" value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    onClick={() => setModelName('')}
                    placeholder="например: llama3.2:3b"
                    className="ml-6 w-full text-sm border-none bg-transparent outline-none text-surface-800 placeholder:text-surface-400"
                  />
                </div>
              </div>
            )}

            {provider === 'openai' && (
              <>
                <div className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
                  <h2 className="text-sm font-semibold text-surface-800 mb-3">Модель</h2>
                  <input
                    type="text"
                    value={customModel || modelName}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder="gpt-4o, gpt-4o-mini, ..."
                    className="w-full text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                  <p className="text-xs text-surface-400 mt-1.5">
                    Совместимые модели: gpt-4o, gpt-4o-mini, gpt-4-turbo и другие
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-surface-500" />
                      <h2 className="text-sm font-semibold text-surface-800">API ключи</h2>
                      {openaiKeys.length > 0 && (
                        <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                          {openaiKeys.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowAddKey(v => !v); setKeyError('') }}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      {showAddKey
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <Plus className="w-3.5 h-3.5" />
                      }
                      {showAddKey ? 'Свернуть' : 'Добавить'}
                    </button>
                  </div>

                  {keysLoading ? (
                    <div className="flex items-center gap-2 text-sm text-surface-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Загрузка...
                    </div>
                  ) : openaiKeys.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      <AnimatePresence initial={false}>
                        {openaiKeys.map(key => {
                          const testRes = keyTestResults[key.id]
                          return (
                            <motion.div
                              key={key.id}
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, height: 0 }}
                              className={`rounded-xl border px-3 py-2.5 transition-all ${
                                key.is_active
                                  ? 'border-brand-300 bg-brand-50'
                                  : 'border-surface-200 bg-surface-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {key.is_active && (
                                    <Star className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" fill="currentColor" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-surface-800 truncate">{key.label}</p>
                                    <p className="text-xs text-surface-400 font-mono">{key.masked_key}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!key.is_active && (
                                    <button
                                      onClick={() => handleActivateKey(key.id)}
                                      disabled={activatingKeyId === key.id}
                                      title="Активировать"
                                      className="px-2 py-1 rounded-lg text-xs text-brand-600 hover:bg-brand-100 transition-colors disabled:opacity-50"
                                    >
                                      {activatingKeyId === key.id
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : 'Активировать'
                                      }
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleTestKey(key.id)}
                                    disabled={testingKeyId === key.id}
                                    title="Проверить ключ"
                                    className="p-1.5 rounded-lg text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                  >
                                    {testingKeyId === key.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Wifi className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                  <button
                                    onClick={() => handleDeleteKey(key.id)}
                                    disabled={deletingKeyId === key.id}
                                    title="Удалить"
                                    className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                  >
                                    {deletingKeyId === key.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                </div>
                              </div>

                              {testRes && (
                                <div className={`mt-2 flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg ${
                                  testRes.ok
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                  {testRes.ok
                                    ? <Check className="w-3 h-3 flex-shrink-0" />
                                    : <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                  }
                                  {testRes.ok ? 'Ключ работает' : (testRes.error || 'Ключ не работает')}
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
                      <p className="font-medium mb-0.5">Нет сохранённых ключей</p>
                      <p>Добавьте API ключ OpenAI, чтобы использовать облачные модели.</p>
                    </div>
                  )}

                  <AnimatePresence>
                    {showAddKey && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border border-dashed border-surface-300 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-surface-600">Новый ключ</p>

                          <div>
                            <label className="block text-xs text-surface-500 mb-1">Название (необязательно)</label>
                            <input
                              type="text"
                              value={newKeyLabel}
                              onChange={e => setNewKeyLabel(e.target.value)}
                              placeholder="например: Основной GPT-4o"
                              className="w-full text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-300"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-surface-500 mb-1">API ключ</label>
                            <div className="relative">
                              <input
                                type={showKeyValue ? 'text' : 'password'}
                                value={newKeyValue}
                                onChange={e => setNewKeyValue(e.target.value)}
                                placeholder="sk-..."
                                className="w-full text-sm rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 pr-10 text-surface-800 font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
                              />
                              <button
                                type="button"
                                onClick={() => setShowKeyValue(v => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 transition-colors"
                              >
                                {showKeyValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {keyError && (
                            <p className="text-xs text-red-600">{keyError}</p>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => { setShowAddKey(false); setNewKeyLabel(''); setNewKeyValue(''); setKeyError('') }}
                              className="px-3 py-2 rounded-xl text-xs text-surface-600 bg-surface-100 hover:bg-surface-200 transition-colors"
                            >
                              Отмена
                            </button>
                            <motion.button
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              onClick={handleAddKey}
                              disabled={addingKey || !newKeyValue.trim()}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-white gradient-brand disabled:opacity-60 transition-all"
                            >
                              {addingKey
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Plus className="w-3.5 h-3.5" />
                              }
                              Добавить и активировать
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            <div className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-surface-800">Параметры ответа</h2>

              <div>
                <label className="block text-xs font-medium text-surface-600 mb-2">Длина ответа</label>
                <div className="grid grid-cols-3 gap-2">
                  {RESPONSE_LENGTH_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setMaxTokens(p.value)}
                      className={`px-3 py-2.5 rounded-xl text-center border transition-all ${
                        maxTokens === p.value
                          ? 'gradient-brand text-white border-transparent'
                          : 'text-surface-600 bg-surface-50 border-surface-200 hover:border-surface-300'
                      }`}
                    >
                      <div className="text-sm font-semibold">{p.label}</div>
                      <div className={`text-xs mt-0.5 ${maxTokens === p.value ? 'text-white/70' : 'text-surface-400'}`}>
                        {p.hint}
                      </div>
                    </button>
                  ))}
                </div>
                {!lengthPreset && (
                  <p className="text-xs text-surface-400 mt-1.5">Текущее значение: {maxTokens} токенов</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 mb-2">Стиль ответа</label>
                <div className="grid grid-cols-3 gap-2">
                  {STYLE_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setTemperature(p.value)}
                      className={`px-3 py-2.5 rounded-xl text-center border transition-all ${
                        stylePreset?.value === p.value
                          ? 'gradient-brand text-white border-transparent'
                          : 'text-surface-600 bg-surface-50 border-surface-200 hover:border-surface-300'
                      }`}
                    >
                      <div className="text-sm font-semibold">{p.label}</div>
                      <div className={`text-xs mt-0.5 ${stylePreset?.value === p.value ? 'text-white/70' : 'text-surface-400'}`}>
                        {p.hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
              {testResult && (
                <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl mb-3 ${
                  testResult.ok
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testResult.ok
                    ? <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  }
                  <div>
                    {testResult.ok
                      ? `Соединение успешно. Модель ${testResult.model} отвечает.`
                      : `Ошибка: ${testResult.error || 'модель не отвечает'}`
                    }
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
              {!activeModel && <p className="text-xs text-amber-600 mb-3">Выберите или введите модель</p>}

              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleTest}
                  disabled={testing || !activeModel}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-surface-700 bg-surface-100 border border-surface-200 hover:bg-surface-200 disabled:opacity-50 transition-all"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  Проверить
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving || !activeModel}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white gradient-brand disabled:opacity-60 hover:opacity-90 transition-all"
                >
                  {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : saved ? <Check className="w-4 h-4" /> : null
                  }
                  {saved ? 'Сохранено!' : 'Применить'}
                </motion.button>
              </div>
            </div>

            {llmSettings && (
              <p className="text-xs text-surface-400 text-center">
                Активно: <span className="font-medium">{llmSettings.provider}</span> / <span className="font-medium">{llmSettings.model_name}</span>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
