export interface CommandItem {
  label: string
  description: string
  command: string
  icon: string
}

export const COMMANDS: CommandItem[] = [
  { label: '/背单词', description: '开始词汇学习', command: '/背单词', icon: '📚' },
  { label: '/复习', description: '复习已学内容', command: '/复习', icon: '🔄' },
  { label: '/长难句', description: '长难句练习', command: '/长难句', icon: '📝' },
  { label: '/语法纠错', description: '语法纠错训练', command: '/语法纠错', icon: '✏️' },
  { label: '/自由聊天', description: '自由对话练习', command: '/自由聊天', icon: '💬' },
  { label: '/今日计划', description: '查看今日学习计划', command: '/今日计划', icon: '📋' },
  { label: '/无限学习', description: '无限学习模式', command: '/无限学习', icon: '♾️' },
  { label: '/总结', description: '学习总结', command: '/总结', icon: '📊' },
  { label: '/设置语言', description: '切换学习语言', command: '/设置语言', icon: '🌍' },
  { label: '/错词', description: '查看易错词汇', command: '/错词', icon: '❌' },
  { label: '/settings', description: '打开设置', command: '/settings', icon: '⚙️' }
]

interface SlashCommandMenuProps {
  visible: boolean
  filteredCommands: CommandItem[]
  selectedIndex: number
  onSelect: (command: CommandItem) => void
  onHover: (index: number) => void
}

export default function SlashCommandMenu({ visible, filteredCommands, selectedIndex, onSelect, onHover }: SlashCommandMenuProps) {
  if (!visible || filteredCommands.length === 0) return null

  return (
    <div className="command-menu">
      {filteredCommands.map((cmd, index) => (
        <div
          key={cmd.label}
          className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => onHover(index)}
        >
          <span className="command-icon">{cmd.icon}</span>
          <span className="command-label">{cmd.label}</span>
          <span className="command-description">{cmd.description}</span>
        </div>
      ))}
    </div>
  )
}
