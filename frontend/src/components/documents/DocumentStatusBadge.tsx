import type { DocumentStatus } from '../../types/document'

const CONFIG: Record<DocumentStatus, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Ожидание', bg: '#f1f5f9', color: '#64748b' },
  indexing: { label: 'Индексация...', bg: '#fef9c3', color: '#854d0e' },
  indexed:  { label: 'Готов', bg: '#dcfce7', color: '#166534' },
  error:    { label: 'Ошибка', bg: '#fee2e2', color: '#991b1b' },
}

export default function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = CONFIG[status]
  return (
    <span style={{
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: '0.78rem',
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}
