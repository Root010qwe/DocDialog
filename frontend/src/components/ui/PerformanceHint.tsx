import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export interface PerfInfo {
  model: string
  provider: string
  ollama_url?: string | null
  secs_per_summary_group: number
  secs_per_chat_response: number
  note: string
}

interface Props {
  perf: PerfInfo
  context: 'chat' | 'summary'
  groupCount?: number
}

function fmtTime(secs: number): string {
  if (secs < 60) return `~${secs} сек`
  const m = Math.round(secs / 60)
  return `~${m} мин`
}

const TOOLTIP_HEIGHT = 220
const TOOLTIP_WIDTH = 288
const GAP = 8

export default function PerformanceHint({ perf, context, groupCount }: Props) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const estimateLabel = context === 'summary' && groupCount
    ? `Саммари (${groupCount} групп): ${fmtTime(perf.secs_per_summary_group * groupCount)}`
    : `Ответ на запрос: ${fmtTime(perf.secs_per_chat_response)}`

  const device = perf.provider === 'ollama'
    ? (perf.ollama_url?.includes('host.docker.internal') ? 'Хост · Apple M4 · Metal GPU' : 'Локально · Ollama')
    : 'OpenAI API · облако'

  const handleMouseEnter = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
    setOpen(true)
  }

  const getStyle = (): React.CSSProperties => {
    if (!rect) return { display: 'none' }

    const spaceAbove = rect.top
    const showBelow = spaceAbove < TOOLTIP_HEIGHT + GAP * 2

    // Horizontal: align to right edge of icon, clamp so it doesn't go off-screen
    const rightEdge = window.innerWidth - rect.right
    const clampedRight = Math.max(GAP, Math.min(rightEdge, window.innerWidth - TOOLTIP_WIDTH - GAP))

    if (showBelow) {
      return {
        position: 'fixed',
        top: rect.bottom + GAP,
        right: clampedRight,
      }
    }
    return {
      position: 'fixed',
      bottom: window.innerHeight - rect.top + GAP,
      right: clampedRight,
    }
  }

  const isBelow = rect ? rect.top < TOOLTIP_HEIGHT + GAP * 2 : false

  return (
    <div
      ref={ref}
      className="inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setOpen(false)}
    >
      <Info className="w-3.5 h-3.5 text-surface-400 cursor-help hover:text-surface-600 transition-colors" />

      {open && rect && createPortal(
        <div
          style={getStyle()}
          className="w-72 bg-surface-900 text-white text-xs rounded-2xl p-3.5 shadow-2xl z-[9999] pointer-events-none"
        >
          {!isBelow && (
            <div className="absolute -bottom-1.5 right-3 w-3 h-3 bg-surface-900 rotate-45 rounded-sm" />
          )}
          {isBelow && (
            <div className="absolute -top-1.5 right-3 w-3 h-3 bg-surface-900 rotate-45 rounded-sm" />
          )}

          <p className="font-semibold text-white mb-2">Производительность ИИ</p>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-surface-400">Модель</span>
              <span className="font-mono text-brand-300">{perf.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Устройство</span>
              <span className="text-surface-200">{device}</span>
            </div>
            <div className="border-t border-surface-700 my-2" />
            <div className="flex justify-between">
              <span className="text-surface-400">{context === 'summary' ? 'Саммари' : 'Ответ на вопрос'}</span>
              <span className="text-emerald-400 font-medium">{estimateLabel}</span>
            </div>
            {context === 'summary' && (
              <div className="flex justify-between">
                <span className="text-surface-400">На группу</span>
                <span className="text-surface-300">{fmtTime(perf.secs_per_summary_group)}</span>
              </div>
            )}
            <div className="border-t border-surface-700 my-2" />
            <p className="text-surface-400 leading-relaxed">{perf.note}</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
