import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import clsx from 'clsx'

interface ChatInputProps {
  onSendMessage: (content: string) => void
  isDisabled?: boolean
  placeholder?: string
}

export default function ChatInput({
  onSendMessage,
  isDisabled = false,
  placeholder = 'Задайте вопрос о документах...',
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isDisabled) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isDisabled) {
      e.preventDefault()
      if (input.trim()) handleSubmit(e)
    }
  }

  const canSend = input.trim().length > 0 && !isDisabled

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 border-t border-surface-100 bg-white/80 backdrop-blur-sm"
    >
      <div className="flex items-end gap-2 bg-surface-50 border border-surface-200 rounded-2xl px-3 py-2 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-3 focus-within:ring-brand-500/8 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className="flex-1 bg-transparent text-sm text-surface-900 placeholder:text-surface-400 resize-none focus:outline-none min-h-[24px] max-h-[120px] py-0.5 leading-relaxed disabled:opacity-60"
        />
        <motion.button
          type="submit"
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.05 } : {}}
          whileTap={canSend ? { scale: 0.95 } : {}}
          className={clsx(
            'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
            canSend
              ? 'gradient-brand text-white shadow-sm'
              : 'bg-surface-200 text-surface-400 cursor-not-allowed'
          )}
          title="Отправить (Enter)"
        >
          <Send className="w-3.5 h-3.5" />
        </motion.button>
      </div>
      <p className="text-[11px] text-surface-400 text-center mt-1.5">
        Enter — отправить · Shift+Enter — новая строка · Ответы на основе загруженных документов
      </p>
    </form>
  )
}
