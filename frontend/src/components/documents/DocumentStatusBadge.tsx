import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react'
import type { DocumentStatus } from '../../types/document'
import clsx from 'clsx'

interface Props {
  status: DocumentStatus
  progress?: number
}

export default function DocumentStatusBadge({ status, progress = 0 }: Props) {
  if (status === 'indexing') {
    const pct = Math.max(0, Math.min(100, progress))
    return (
      <div className="flex flex-col items-end gap-1 min-w-[90px]">
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 text-amber-600 animate-spin flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-700">{pct}%</span>
        </div>
        <div className="w-20 h-1.5 bg-amber-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>
    )
  }

  const cfg = {
    pending: {
      label: 'Ожидание',
      className: 'bg-surface-100 text-surface-600 border-surface-200',
      icon: <Clock className="w-3 h-3" />,
    },
    indexed: {
      label: 'Готов',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    error: {
      label: 'Ошибка',
      className: 'bg-red-50 text-accent-rose border-red-200',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  }[status]

  if (!cfg) return null

  return (
    <motion.span
      layout
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
        cfg.className
      )}
    >
      {cfg.icon}
      {cfg.label}
    </motion.span>
  )
}
