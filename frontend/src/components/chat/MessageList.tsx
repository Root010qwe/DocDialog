import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import type { DialogMessage } from '../../types/dialog'
import MessageBubble from './MessageBubble'

interface MessageListProps {
  messages: DialogMessage[]
  isLoading?: boolean
}

export default function MessageList({ messages, isLoading = false }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && !isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full text-center py-12"
        >
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7 text-surface-400" />
          </div>
          <p className="text-sm font-medium text-surface-700 mb-1">Начните диалог</p>
          <p className="text-xs text-surface-400 max-w-xs">
            Задайте вопрос о загруженных документах — я отвечу с точными ссылками на источники
          </p>
        </motion.div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>
      )}
      <div ref={endRef} />
    </div>
  )
}
