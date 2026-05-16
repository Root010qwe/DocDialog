import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown, BookOpen } from 'lucide-react'
import type { Citation } from '../../types/dialog'

interface CitationCardProps {
  citation: Citation
  index: number
}

export default function CitationCard({ citation, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white rounded-xl border border-surface-200 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-50 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-3.5 h-3.5 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-surface-800 truncate">{citation.document_title}</p>
          {citation.page_number && (
            <p className="text-[11px] text-surface-400">стр. {citation.page_number}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full"
            title="Позиция источника по релевантности к ответу"
          >
            #{index + 1}
          </span>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-surface-100">
              {citation.section_title && (
                <div className="flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-3 h-3 text-surface-400" />
                  <p className="text-[11px] text-surface-500 italic">{citation.section_title}</p>
                </div>
              )}
              <p className="text-xs text-surface-600 leading-relaxed line-clamp-4">
                {citation.chunk_text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
