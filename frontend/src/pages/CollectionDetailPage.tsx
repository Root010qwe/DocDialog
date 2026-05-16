import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, MessageSquare, Sparkles, X, ChevronRight,
  Loader2, FileStack, Clock, Share2, Pencil, CheckCircle2,
} from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import { useDialogStore } from '../store/dialogStore'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import DocumentUpload from '../components/documents/DocumentUpload'
import DocumentList from '../components/documents/DocumentList'
import ChatWindow from '../components/chat/ChatWindow'
import ShareCollectionModal from '../components/collections/ShareCollectionModal'
import CollectionEditModal from '../components/collections/CollectionEditModal'
import SimpleMarkdown from '../components/ui/SimpleMarkdown'
import PerformanceHint, { type PerfInfo } from '../components/ui/PerformanceHint'

type SummaryStage = 'analyzing' | 'finalizing' | 'done'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showChat, setShowChat] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const { accessToken, user } = useAuthStore()
  const {
    collections, documents, documentsLoading,
    fetchCollections, fetchDocuments, uploadDocument,
    moveDocument, deleteDocument, updateCollection,
  } = useCollectionStore()
  const { dialogs, fetchDialogs, currentDialog, setCurrentDialog } = useDialogStore()

  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryStage, setSummaryStage] = useState<SummaryStage>('analyzing')
  const [summaryProgress, setSummaryProgress] = useState({ current: 0, total: 0 })
  const [summaryFragments, setSummaryFragments] = useState(0)
  const [summaryContent, setSummaryContent] = useState('')
  const [summaryStartTime, setSummaryStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)

  const [perfInfo, setPerfInfo] = useState<PerfInfo | null>(null)
  useEffect(() => {
    apiClient.get<PerfInfo>('/settings/performance')
      .then(r => setPerfInfo(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!summaryLoading || !summaryStartTime) { setElapsed(0); return }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - summaryStartTime) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [summaryLoading, summaryStartTime])

  const collection = collections.find(c => c.id === id)
  const isOwner = collection?.user_role === 'owner'
  const canEdit = isOwner
  const canUpload = collection?.user_role !== 'viewer'

  useEffect(() => {
    if (collections.length === 0) fetchCollections()
    if (id) fetchDocuments(id)
  }, [id]) // eslint-disable-line

  useEffect(() => {
    if (id) fetchDialogs()
  }, [id]) // eslint-disable-line

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const timer = setInterval(async () => {
      if (!cancelled) await fetchDocuments(id)
    }, 4000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [id]) // eslint-disable-line

  const handleUpload = async (file: File, description?: string, tags?: string[]) => {
    if (!id) return
    await uploadDocument(id, file, description, tags)
  }
  const handleDelete = async (docId: string) => { if (id) await deleteDocument(id, docId) }
  const handleMove = async (docId: string, targetCollectionId: string) => {
    if (id) await moveDocument(id, docId, targetCollectionId)
  }

  const handleSummarize = useCallback(async () => {
    if (!id) return

    setSummaryOpen(true)
    setSummaryContent('')
    setSummaryStage('analyzing')
    setSummaryProgress({ current: 0, total: 0 })
    setSummaryFragments(0)
    setElapsed(0)

    const headers: Record<string, string> = {}
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    try {
      const cached = await apiClient.get<{
        is_valid: boolean; text: string | null; current_doc_count: number
      }>(`/collections/${id}/summary/cached`)
      if (cached.data.is_valid && cached.data.text) {
        setSummaryContent(cached.data.text)
        setSummaryStage('done')
        return
      }
    } catch { /* fall through to full generation */ }

    setSummaryLoading(true)
    setSummaryStartTime(Date.now())

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const res = await fetch(`/api/v1/collections/${id}/summary`, { headers })
      if (!res.ok || !res.body) return
      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (!parsed.chunk) continue
            const chunk: string = parsed.chunk

            const fragM = chunk.match(/Анализирую (\d+) фрагментов[^(]*\((\d+) из (\d+)/)
            if (fragM) {
              setSummaryFragments(parseInt(fragM[1]))
              setSummaryProgress({ current: 0, total: parseInt(fragM[3]) })
              continue
            }

            const groupM = chunk.match(/Группа (\d+)\/(\d+)/)
            if (groupM) {
              setSummaryProgress({ current: parseInt(groupM[1]), total: parseInt(groupM[2]) })
              setSummaryStage('analyzing')
              continue
            }

            if (chunk.includes('Формирую')) {
              setSummaryStage('finalizing')
              continue
            }

            setSummaryContent(prev => prev + chunk)
          } catch { /* skip malformed */ }
        }
      }

      setSummaryStage('done')
    } catch { /* ignore */ }
    finally {
      reader?.releaseLock()
      setSummaryLoading(false)
    }
  }, [id, accessToken])

  const collectionDialogs = dialogs.filter(d => d.collection_id === id)
  const hasIndexedDocs = documents.some(d => d.status === 'indexed')

  const secsPerGroup = perfInfo?.secs_per_summary_group ?? 15
  const estimatedTotal = summaryProgress.total * secsPerGroup
  const estimatedRemaining = summaryLoading
    ? Math.max(0, estimatedTotal - elapsed)
    : 0
  const progressPct = summaryProgress.total > 0
    ? Math.round((summaryProgress.current / summaryProgress.total) * 100)
    : (summaryStage === 'finalizing' ? 95 : 0)

  function fmtSecs(s: number) {
    if (s < 60) return `${s} сек`
    return `${Math.ceil(s / 60)} мин`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50/30">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-surface-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <motion.button
            whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/collections')}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Коллекции
          </motion.button>

          <div className="w-px h-4 bg-surface-200" />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 gradient-brand rounded-md flex items-center justify-center flex-shrink-0">
              <FileStack className="w-3 h-3 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-surface-900 truncate">
              {collection?.name ?? 'Коллекция'}
            </h1>
            {!showChat && canEdit && (
              <button
                onClick={() => setShowEdit(true)}
                title="Редактировать коллекцию"
                className="p-1 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!showChat && (
            <div className="flex items-center gap-2">
              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-surface-600 bg-surface-100 border border-surface-200 hover:bg-surface-200 transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Поделиться
                </motion.button>
              )}

              <motion.button
                whileHover={hasIndexedDocs ? { scale: 1.03 } : {}}
                whileTap={hasIndexedDocs ? { scale: 0.97 } : {}}
                onClick={handleSummarize}
                disabled={summaryLoading || !hasIndexedDocs}
                title={!hasIndexedDocs ? 'Дождитесь завершения индексации документов' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  hasIndexedDocs
                    ? 'text-surface-600 bg-surface-100 border-surface-200 hover:bg-surface-200 disabled:opacity-60'
                    : 'text-surface-400 bg-surface-50 border-surface-200 opacity-50 cursor-not-allowed'
                }`}
              >
                {summaryLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />
                }
                {summaryLoading ? 'Анализ...' : 'Саммари'}
              </motion.button>

              <motion.button
                whileHover={hasIndexedDocs ? { scale: 1.03 } : {}}
                whileTap={hasIndexedDocs ? { scale: 0.97 } : {}}
                onClick={() => { if (hasIndexedDocs) { setCurrentDialog(null); setShowChat(true) } }}
                disabled={!hasIndexedDocs}
                title={!hasIndexedDocs ? 'Дождитесь завершения индексации документов' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all ${
                  hasIndexedDocs
                    ? 'text-white gradient-brand hover:opacity-90 cursor-pointer'
                    : 'text-surface-400 bg-surface-200 border border-surface-300 opacity-50 cursor-not-allowed'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Начать диалог
              </motion.button>
            </div>
          )}

          {showChat && (
            <motion.button
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowChat(false)}
              className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться
            </motion.button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {showChat && id ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
              className="h-[calc(100vh-120px)]"
            >
              <ChatWindow collectionId={id} dialog={currentDialog} perfInfo={perfInfo} />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <AnimatePresence>
                {summaryOpen && (
                  <motion.div
                    ref={summaryRef}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white rounded-2xl border border-brand-200 shadow-[var(--shadow-card)] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
                            {summaryStage === 'done'
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              : <Sparkles className="w-3.5 h-3.5 text-white" />
                            }
                          </div>
                          <h2 className="text-sm font-semibold text-surface-900">
                            Аналитическое саммари
                          </h2>
                          {summaryLoading && (
                            <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {perfInfo && (
                            <PerformanceHint
                              perf={perfInfo}
                              context="summary"
                              groupCount={summaryProgress.total || undefined}
                            />
                          )}
                          <button
                            onClick={() => setSummaryOpen(false)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {summaryLoading && (
                        <div className="mb-4 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-surface-500 font-medium">
                              {summaryStage === 'finalizing'
                                ? 'Формирую итоговое резюме...'
                                : summaryProgress.total > 0
                                  ? `Группа ${summaryProgress.current} из ${summaryProgress.total}`
                                  : 'Подготовка...'
                              }
                            </span>
                            <span className="text-surface-400 tabular-nums">
                              {elapsed > 0 && `${fmtSecs(elapsed)} прошло`}
                              {estimatedRemaining > 3 && ` · ~${fmtSecs(estimatedRemaining)} осталось`}
                            </span>
                          </div>

                          <div className="relative h-2 bg-surface-100 rounded-full overflow-hidden">
                            <motion.div
                              className="absolute inset-y-0 left-0 gradient-brand rounded-full"
                              animate={{ width: `${summaryStage === 'finalizing' ? 95 : progressPct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                            <motion.div
                              className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              animate={{ x: ['-100%', '500%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            />
                          </div>

                          {summaryProgress.total > 0 && estimatedTotal > 30 && summaryStage !== 'done' && (
                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>
                                Ожидаемое время: <strong>{fmtSecs(estimatedTotal)}</strong>
                                {' '}· {summaryFragments > 0 && `${summaryFragments} фрагментов, `}
                                {summaryProgress.total} групп · {perfInfo?.model}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {summaryContent ? (
                        <SimpleMarkdown content={summaryContent} />
                      ) : summaryLoading && summaryProgress.total === 0 ? (
                        <p className="text-sm text-surface-400">Загружаю данные коллекции...</p>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {canUpload && (
                <section className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
                  <h2 className="text-sm font-semibold text-surface-700 mb-3">Загрузить документ</h2>
                  <DocumentUpload onUpload={handleUpload} />
                </section>
              )}

              <section className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-surface-700">Документы</h2>
                  {documents.length > 0 && (
                    <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                      {documents.length}
                    </span>
                  )}
                </div>
                {documentsLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-surface-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Загрузка...
                  </div>
                ) : (
                  <DocumentList
                    documents={documents}
                    collectionId={id ?? ''}
                    onDelete={handleDelete}
                    onMove={handleMove}
                    canManage={canUpload}
                  />
                )}
              </section>

              <section className="bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-surface-700">История диалогов</h2>
                  {collectionDialogs.length > 0 && (
                    <span className="text-[11px] font-semibold text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full">
                      {collectionDialogs.length}
                    </span>
                  )}
                </div>
                {collectionDialogs.length === 0 ? (
                  <p className="text-sm text-surface-400 py-2">
                    Диалогов пока нет — нажмите «Начать диалог»
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <AnimatePresence initial={false}>
                      {collectionDialogs.map((dialog, i) => (
                        <motion.button
                          key={dialog.id}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => { setCurrentDialog(dialog); setShowChat(true) }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-surface-50 border border-transparent hover:border-surface-200 transition-all group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-50 transition-colors">
                            <MessageSquare className="w-3.5 h-3.5 text-surface-400 group-hover:text-brand-500 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-800 truncate">
                              {dialog.title || 'Диалог без названия'}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-surface-400" />
                              <p className="text-[11px] text-surface-400">
                                {new Date(dialog.created_at).toLocaleDateString('ru-RU', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showShare && id && collection && (
        <ShareCollectionModal
          collectionId={id}
          collectionName={collection.name}
          currentUserId={user?.id ?? ''}
          onClose={() => setShowShare(false)}
        />
      )}
      {showEdit && id && collection && (
        <CollectionEditModal
          collection={collection}
          onSave={async (data) => { await updateCollection(id, data); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
