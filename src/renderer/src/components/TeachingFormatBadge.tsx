interface TeachingFormatBadgeProps {
  format: string
}

const FORMAT_CONFIG: Record<string, { label: string; icon: string }> = {
  story: { label: '故事', icon: '📖' },
  discussion: { label: '讨论', icon: '💬' },
  knowledge: { label: '知识分享', icon: '🧠' },
  essay: { label: '考研小短文', icon: '📝' },
  comparison: { label: '易混词对比', icon: '🔄' }
}

export default function TeachingFormatBadge({ format }: TeachingFormatBadgeProps) {
  const config = FORMAT_CONFIG[format] || { label: format, icon: '📚' }

  return (
    <span className="teaching-format-badge" title={config.label}>
      <span className="format-icon">{config.icon}</span>
      <span className="format-label">{config.label}</span>
    </span>
  )
}
