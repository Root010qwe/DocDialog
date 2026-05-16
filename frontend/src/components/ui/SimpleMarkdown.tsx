import type { ReactNode } from 'react'

function parseInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-surface-900">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    return part
  })
}

export default function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-surface-900 mt-5 mb-2 first:mt-0">
          {parseInline(line.slice(4))}
        </h3>
      )
      i++; continue
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-surface-800 mt-4 mb-1.5">
          {parseInline(line.slice(5))}
        </h4>
      )
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-surface-900 mt-5 mb-2">
          {parseInline(line.slice(3))}
        </h2>
      )
      i++; continue
    }

    // Ordered or unordered list — collect consecutive items
    const isOrdered = /^\d+\.\s/.test(line)
    const isUnordered = /^[-*]\s/.test(line)
    if (isOrdered || isUnordered) {
      const items: ReactNode[] = []
      const ordered = isOrdered
      while (i < lines.length && (/^\d+\.\s/.test(lines[i]) || /^[-*]\s/.test(lines[i]))) {
        const itemText = lines[i].replace(/^\d+\.\s/, '').replace(/^[-*]\s/, '')
        items.push(
          <li key={i} className="text-sm text-surface-700 leading-relaxed">
            {parseInline(itemText)}
          </li>
        )
        i++
      }
      elements.push(
        ordered
          ? <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 pl-1">{items}</ol>
          : <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 pl-1">{items}</ul>
      )
      continue
    }

    if (!line.trim()) { i++; continue }

    elements.push(
      <p key={i} className="text-sm text-surface-700 leading-relaxed">
        {parseInline(line)}
      </p>
    )
    i++
  }

  return <div className="space-y-1.5">{elements}</div>
}
