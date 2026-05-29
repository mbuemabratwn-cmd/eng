import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

interface Message {
  id: number
  role: string
  content: string
  created_at: string
}

interface MessageListProps {
  messages: Message[]
  loading?: boolean
  onRetry?: (messageId: number) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

const FOLD_THRESHOLD = 500 // Characters before folding

export default function MessageList({ messages, loading, onRetry, hasMore, loadingMore, onLoadMore }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const isError = (content: string) => content.startsWith('[错误]') || content.includes('AI 响应失败')

  const toggleExpand = (messageId: number) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  const shouldFold = (content: string) => content.length > FOLD_THRESHOLD

  const getDisplayContent = (message: Message) => {
    if (!shouldFold(message.content) || expandedMessages.has(message.id)) {
      return message.content
    }
    return message.content.substring(0, FOLD_THRESHOLD) + '...'
  }

  return (
    <div className="message-list">
      {hasMore && (
        <div className="load-more-container">
          <button
            className="load-more-btn"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? '加载中...' : '加载更多历史消息'}
          </button>
        </div>
      )}
      {messages.length === 0 && (
        <div className="message-empty">
          开始与你的 AI 英语老师对话吧。
        </div>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}
        >
          {msg.role === 'assistant' && (
            <div className="message-avatar">AI</div>
          )}
          <div className="message-bubble">
            {msg.role === 'user' ? (
              <p className="message-text">{msg.content}</p>
            ) : (
              <div className="message-markdown">
                <Markdown>{getDisplayContent(msg)}</Markdown>
                {shouldFold(msg.content) && (
                  <button
                    className="expand-btn"
                    onClick={() => toggleExpand(msg.id)}
                  >
                    {expandedMessages.has(msg.id) ? '收起' : '展开全文'}
                  </button>
                )}
                {isError(msg.content) && onRetry && msg.id > 0 && (
                  <button className="retry-btn" onClick={() => onRetry(msg.id)}>
                    重试
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="message message-assistant">
          <div className="message-avatar">AI</div>
          <div className="message-bubble">
            <div className="typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
