import { useState, useRef, KeyboardEvent } from 'react'
import SlashCommandMenu, { COMMANDS, CommandItem } from './SlashCommandMenu'

interface MessageInputProps {
  onSend: (content: string) => void
  onFileUpload?: (filePath: string) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onFileUpload, disabled }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Check if user is typing a command
    if (newValue.startsWith('/')) {
      const query = newValue.slice(1).toLowerCase()
      const filtered = COMMANDS.filter(cmd =>
        cmd.label.slice(1).toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      )
      setFilteredCommands(filtered)
      setShowCommands(filtered.length > 0)
      setSelectedIndex(0)
    } else {
      setShowCommands(false)
    }
  }

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    setShowCommands(false)
    inputRef.current?.focus()
  }

  const handleSelectCommand = (command: CommandItem) => {
    onSend(command.command)
    setValue('')
    setShowCommands(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSelectCommand(filteredCommands[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowCommands(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAttachClick = async () => {
    if (disabled) return
    const filePath = await window.appApi.selectFile()
    if (filePath && onFileUpload) {
      onFileUpload(filePath)
    }
  }

  return (
    <div className="message-input-wrapper">
      <SlashCommandMenu
        visible={showCommands}
        filteredCommands={filteredCommands}
        selectedIndex={selectedIndex}
        onSelect={handleSelectCommand}
        onHover={setSelectedIndex}
      />
      <div className="message-input-container">
        <button
          className="attach-button"
          onClick={handleAttachClick}
          disabled={disabled}
          title="上传文件"
        >
          +
        </button>
        <textarea
          ref={inputRef}
          className="message-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (/ 打开命令菜单，回车发送)"
          disabled={disabled}
          rows={2}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!value.trim()}
        >
          {disabled ? '中断' : '发送'}
        </button>
      </div>
    </div>
  )
}
