import { useState, useEffect, useCallback } from 'react'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'
import LearningStatusBar from '../components/LearningStatusBar'
import LearningTimer from '../components/LearningTimer'

interface Message {
  id: number
  role: string
  content: string
  created_at: string
}

interface ChatPageProps {
  sessionId?: number | null
  onSettingsClick?: () => void
}

export default function ChatPage({ sessionId: externalSessionId, onSettingsClick }: ChatPageProps = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{ intent: string; message: string } | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const PAGE_SIZE = 50

  const loadMessages = useCallback(async (sid: number) => {
    const msgs = await window.appApi.getMessages(sid, PAGE_SIZE, 0)
    setMessages(msgs.reverse())
    setHasMore(msgs.length >= PAGE_SIZE)
  }, [])

  const loadMoreMessages = useCallback(async () => {
    if (!sessionId || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const olderMsgs = await window.appApi.getMessages(sessionId, PAGE_SIZE, messages.length)
      if (olderMsgs.length < PAGE_SIZE) {
        setHasMore(false)
      }
      if (olderMsgs.length > 0) {
        setMessages(prev => [...olderMsgs.reverse(), ...prev])
      }
    } catch (err) {
      console.error('Failed to load more messages:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [sessionId, messages.length, loadingMore, hasMore])

  useEffect(() => {
    const init = async () => {
      if (externalSessionId) {
        setSessionId(externalSessionId)
        await loadMessages(externalSessionId)
      } else {
        const state = await window.appApi.getCurrentLearningState()
        if (state.currentSessionId) {
          setSessionId(state.currentSessionId)
          await loadMessages(state.currentSessionId)
        }
      }
    }
    init()
  }, [loadMessages, externalSessionId])

  const handleSend = async (content: string) => {
    setError(null)

    // Handle /settings command locally
    if (content === '/settings' && onSettingsClick) {
      onSettingsClick()
      return
    }

    // If currently loading, abort the current request
    if (loading) {
      await window.appApi.abortCurrentRequest()
      // Mark the last assistant message as cancelled if it exists
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id > 0) {
          return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + '\n\n[已取消]' }]
        }
        return prev
      })
    }

    // Show user message immediately
    const tempUserMsg: Message = {
      id: Date.now(),
      role: 'user',
      content,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])
    setLoading(true)

    try {
      const result = await window.appApi.sendMessage(content, sessionId || undefined)
      setSessionId(result.sessionId)

      // Replace temp user message with real one
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempUserMsg.id)
        return [...withoutTemp, result.userMessage]
      })

      // Check if action requires confirmation
      if (result.requiresConfirmation) {
        setPendingConfirmation({
          intent: result.pendingIntent || 'unknown',
          message: result.confirmationMessage || '此操作需要确认。'
        })
        setMessages(prev => [...prev, {
          id: -2,
          role: 'assistant',
          content: result.confirmationMessage || '此操作需要确认。输入"确认"继续，或输入"取消"中止。',
          created_at: new Date().toISOString()
        }])
        return
      }

      // Show assistant message
      if (result.assistantMessage) {
        setMessages(prev => [...prev, result.assistantMessage!])
      } else if (result.error) {
        setMessages(prev => [...prev, {
          id: -1,
          role: 'assistant',
          content: `[错误] AI 响应失败: ${result.error}。你的消息已保存。`,
          created_at: new Date().toISOString()
        }])
        setError(result.error)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('发送消息失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (filePath: string) => {
    setError(null)
    setLoading(true)

    try {
      // Read file content via IPC
      const { filename, content } = await window.appApi.readFileContent(filePath)

      // Show user message about file upload
      const fileMsg: Message = {
        id: Date.now(),
        role: 'user',
        content: `[上传文件] ${filename}`,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, fileMsg])

      // Show "正在导入..." status
      const statusMsgId = Date.now() + 1
      setMessages(prev => [...prev, {
        id: statusMsgId,
        role: 'assistant',
        content: `正在导入文件 "${filename}"...`,
        created_at: new Date().toISOString()
      }])

      // Ingest file
      const result = await window.appApi.ingestFile({
        filename,
        content,
        filePath
      })

      if (result.skipped) {
        // Update status message with skip reason
        setMessages(prev => prev.map(m =>
          m.id === statusMsgId
            ? { ...m, content: `文件 "${filename}" 已跳过: ${result.reason || '重复文件'}` }
            : m
        ))
      } else {
        const candidateCount = result.importCandidates.length
        // Update status message to show processing
        setMessages(prev => prev.map(m =>
          m.id === statusMsgId
            ? { ...m, content: `正在导入 "${filename}"：识别出 ${candidateCount} 个词汇，正在处理...` }
            : m
        ))

        // Poll job status until completion
        if (result.jobId) {
          await pollJobUntilDone(result.jobId, statusMsgId, filename, candidateCount)
        }
      }
    } catch (err) {
      console.error('Failed to upload file:', err)
      const message = err instanceof Error ? err.message : '文件上传失败'
      setError(message)
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `[错误] ${message}`,
        created_at: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  const pollJobUntilDone = async (jobId: number, statusMsgId: number, filename: string, candidateCount: number) => {
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))
      try {
        const job = await window.appApi.getJobStatus(jobId)
        if (!job) break

        if (job.status === 'done') {
          setMessages(prev => prev.map(m =>
            m.id === statusMsgId
              ? { ...m, content: `文件 "${filename}" 导入完成：共 ${candidateCount} 个词汇已入库。` }
              : m
          ))
          return
        } else if (job.status === 'failed') {
          setMessages(prev => prev.map(m =>
            m.id === statusMsgId
              ? { ...m, content: `文件 "${filename}" 导入失败：${job.error || '未知错误'}` }
              : m
          ))
          return
        }
      } catch {
        // Ignore polling errors, keep trying
      }
    }
    // Timeout - update message
    setMessages(prev => prev.map(m =>
      m.id === statusMsgId
        ? { ...m, content: `文件 "${filename}" 正在后台导入中，请稍后查看词汇库。` }
        : m
    ))
  }

  const handleRetry = async (messageId: number) => {
    setError(null)
    setLoading(true)
    try {
      const result = await window.appApi.regenerateMessage(messageId, sessionId || undefined)
      if (result.assistantMessage) {
        // Replace the error message with the new response
        setMessages(prev => prev.map(m =>
          m.id === messageId ? result.assistantMessage! : m
        ))
      } else if (result.error) {
        setError(`重试失败: ${result.error}`)
      }
    } catch (err) {
      console.error('Failed to regenerate:', err)
      setError('重试失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAction = async (confirmed: boolean) => {
    if (!pendingConfirmation) return
    setLoading(true)
    try {
      const result = await window.appApi.confirmAction(pendingConfirmation.intent, confirmed)
      setMessages(prev => [...prev, {
        id: -3,
        role: 'assistant',
        content: result.message,
        created_at: new Date().toISOString()
      }])
    } catch (err) {
      console.error('Failed to confirm action:', err)
    } finally {
      setPendingConfirmation(null)
      setLoading(false)
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h2>考研英语 AI 陪练</h2>
        <div className="header-actions">
          <LearningTimer sessionId={sessionId} />
          <LearningStatusBar />
          {onSettingsClick && (
            <button className="settings-button" onClick={onSettingsClick} title="设置">
              ⚙️
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="chat-error-banner">
          {error}
          <button onClick={() => setError(null)}>关闭</button>
        </div>
      )}
      <MessageList
        messages={messages}
        loading={loading}
        onRetry={handleRetry}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMoreMessages}
      />
      {pendingConfirmation ? (
        <div className="confirmation-bar">
          <span>{pendingConfirmation.message}</span>
          <button onClick={() => handleConfirmAction(true)} disabled={loading}>确认</button>
          <button onClick={() => handleConfirmAction(false)} disabled={loading}>取消</button>
        </div>
      ) : (
        <MessageInput onSend={handleSend} onFileUpload={handleFileUpload} disabled={loading} />
      )}
    </div>
  )
}
