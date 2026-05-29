import { useState, useRef, KeyboardEvent } from 'react'
import SlashCommandMenu, { COMMANDS, CommandItem } from './SlashCommandMenu'

interface PendingFile {
  path: string
  name: string
}

interface MessageInputProps {
  onSend: (content: string, filePath?: string) => void
  onFileUpload?: (filePath: string) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onFileUpload, disabled }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
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
    if ((!trimmed && !pendingFile) || disabled) return

    if (pendingFile) {
      // Send file with optional text message
      onSend(trimmed || `[上传文件] ${pendingFile.name}`, pendingFile.path)
      setPendingFile(null)
    } else {
      onSend(trimmed)
    }
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
    if (filePath) {
      // Extract filename from path
      const parts = filePath.split(/[/\\]/)
      const filename = parts[parts.length - 1]
      setPendingFile({ path: filePath, name: filename })
      inputRef.current?.focus()
    }
  }

  const handleRemoveFile = () => {
    setPendingFile(null)
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
      {pendingFile && (
        <div className="pending-file-bar">
          <span className="pending-file-icon">📎</span>
          <span className="pending-file-name">{pendingFile.name}</span>
          <button className="pending-file-remove" onClick={handleRemoveFile} title="移除文件">
            ×
          </button>
        </div>
      )}
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
          placeholder={pendingFile ? '添加说明文字（可选）...' : '输入消息... (/ 打开命令菜单，回车发送)'}
          disabled={disabled}
          rows={2}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!value.trim() && !pendingFile}
        >
          {disabled ? '中断' : '发送'}
        </button>
      </div>
    </div>
  )
}
