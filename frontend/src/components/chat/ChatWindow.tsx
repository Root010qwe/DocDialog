import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Download, Sparkles, Plus } from 'lucide-react'
import type { Dialog } from '../../types/dialog'
import { useDialogStore } from '../../store/dialogStore'
import { useAuthStore } from '../../store/authStore'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import PerformanceHint, { type PerfInfo } from '../ui/PerformanceHint'

interface ChatWindowProps {
  collectionId: string
  dialog?: Dialog | null
  perfInfo?: PerfInfo | null
}

export default function ChatWindow({ collectionId, dialog, perfInfo }: ChatWindowProps) {
  const {
    currentDialog,
    messages,
    isStreaming,
    createDialog,
    setCurrentDialog,
    streamMessage,
  } = useDialogStore()
  const { accessToken } = useAuthStore()

  const activeDialog = dialog ?? currentDialog
  const activeTitle = activeDialog?.title

  const handleSendMessage = async (content: string) => {
    let active = activeDialog
    if (!active) {
      active = await createDialog(collectionId)
      if (active) await setCurrentDialog(active)
    }
    if (active) await streamMessage(active.id, content)
  }

  const downloadExport = useCallback(async (format: 'pdf' | 'docx') => {
    const dialogId = activeDialog?.id
    if (!dialogId) return
    const headers: Record<string, string> = {}
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    try {
      const res = await fetch(`/api/v1/dialogs/${dialogId}/export/${format}`, { headers })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dialog_${dialogId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }, [activeDialog, accessToken])

  const handleExportPdf = useCallback(() => downloadExport('pdf'), [downloadExport])
  const handleExportDocx = useCallback(() => downloadExport('docx'), [downloadExport])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-surface-200 shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-surface-50 to-white flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-surface-900 truncate">
                {activeTitle || 'Новый диалог'}
              </h3>
              {perfInfo && <PerformanceHint perf={perfInfo} context="chat" />}
            </div>
            {activeDialog && (
              <p className="text-[11px] text-surface-400">
                {new Date(activeDialog.created_at).toLocaleDateString('ru-RU')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentDialog(null)}
            title="Начать новый диалог"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 bg-surface-100 border border-surface-200 hover:bg-surface-200 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Новый диалог
          </motion.button>
          {hasMessages && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExportPdf}
                title="Экспортировать в PDF"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExportDocx}
                title="Экспортировать в DOCX"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 bg-surface-100 border border-surface-200 hover:bg-surface-200 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                DOCX
              </motion.button>
            </>
          )}
        </div>
      </div>

      <MessageList messages={messages} isLoading={isStreaming} />

      <ChatInput
        onSendMessage={handleSendMessage}
        isDisabled={isStreaming}
        placeholder="Задайте вопрос о документах..."
      />
    </div>
  )
}
