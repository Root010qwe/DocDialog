import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, User, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { DialogMessage } from '../../types/dialog'
import { dialogsApi } from '../../api/dialogs'
import CitationCard from './CitationCard'
import SimpleMarkdown from '../ui/SimpleMarkdown'

interface MessageBubbleProps {
  message: DialogMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isEmpty = !message.content && !isUser
  const [rating, setRating] = useState<'positive' | 'negative' | null>(message.rating ?? null)
  const [ratingLoading, setRatingLoading] = useState(false)

  const handleRate = async (value: 'positive' | 'negative') => {
    if (ratingLoading) return
    const next = rating === value ? null : value
    setRating(next)
    setRatingLoading(true)
    try {
      await dialogsApi.rateMessage(message.dialog_id, message.id, next)
    } catch {
      setRating(rating) // rollback
    } finally {
      setRatingLoading(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser
          ? 'gradient-brand shadow-sm'
          : 'bg-surface-100 border border-surface-200'
      }`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-surface-500" />
        }
      </div>

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${
          isUser
            ? 'gradient-brand text-white rounded-tr-sm shadow-sm whitespace-pre-wrap'
            : 'bg-white border border-surface-200 text-surface-800 rounded-tl-sm shadow-[var(--shadow-card)]'
        }`}>
          {isEmpty ? (
            <span className="flex gap-1 items-center h-4">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-surface-400 inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-surface-400 inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-surface-400 inline-block" />
            </span>
          ) : isUser ? (
            message.content
          ) : message.content ? (
            <SimpleMarkdown content={message.content} />
          ) : (
            <span className="text-accent-rose text-sm">
              Не удалось получить ответ. Проверьте подключение к Ollama.
            </span>
          )}
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="w-full space-y-1.5">
            <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider pl-1">
              Источники ({message.citations.length})
            </p>
            {message.citations.map((citation, i) => (
              <CitationCard key={citation.chunk_id || i} citation={citation} index={i} />
            ))}
          </div>
        )}

        {!isUser && message.content && (
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => handleRate('positive')}
              disabled={ratingLoading}
              title="Полезный ответ"
              className={`p-1 rounded-md transition-all duration-150 ${
                rating === 'positive'
                  ? 'text-green-600 bg-green-50 scale-110'
                  : 'text-surface-400 hover:text-green-500 hover:bg-surface-100'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleRate('negative')}
              disabled={ratingLoading}
              title="Неполезный ответ"
              className={`p-1 rounded-md transition-all duration-150 ${
                rating === 'negative'
                  ? 'text-accent-rose bg-red-50 scale-110'
                  : 'text-surface-400 hover:text-accent-rose hover:bg-surface-100'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <span className="text-[11px] text-surface-400 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}
