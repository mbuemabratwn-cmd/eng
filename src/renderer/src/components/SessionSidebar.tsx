import { useState, useEffect } from 'react'

interface Session {
  id: number
  title: string | null
  session_type: string | null
  started_at: string
  ended_at: string | null
  summary: string | null
}

interface SessionSidebarProps {
  activeSessionId: number | null
  onSessionSelect: (sessionId: number) => void
  onNewSession: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function SessionSidebar({
  activeSessionId,
  onSessionSelect,
  onNewSession,
  collapsed,
  onToggleCollapse
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const result = await window.appApi.getSessionList(50, 0)
      setSessions(result)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  const getSessionIcon = (type: string | null) => {
    switch (type) {
      case 'word_theme_learning': return '📚'
      case 'word_review': return '🔄'
      case 'long_sentence': return '📝'
      case 'grammar_correction': return '✏️'
      case 'free_chat': return '💬'
      default: return '💬'
    }
  }

  if (collapsed) {
    return (
      <div className="session-sidebar collapsed">
        <button className="sidebar-toggle" onClick={onToggleCollapse} title="展开侧边栏">
          ☰
        </button>
        <button className="new-session-btn" onClick={onNewSession} title="新建会话">
          +
        </button>
      </div>
    )
  }

  return (
    <div className="session-sidebar">
      <div className="sidebar-header">
        <h3>历史会话</h3>
        <div className="sidebar-actions">
          <button className="new-session-btn" onClick={onNewSession} title="新建会话">
            +
          </button>
          <button className="sidebar-toggle" onClick={onToggleCollapse} title="收起侧边栏">
            ☰
          </button>
        </div>
      </div>

      <div className="session-list">
        {loading ? (
          <div className="session-loading">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="session-empty">暂无会话</div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSessionSelect(session.id)}
            >
              <div className="session-icon">
                {getSessionIcon(session.session_type)}
              </div>
              <div className="session-info">
                <div className="session-title">
                  {session.title || '未命名会话'}
                </div>
                <div className="session-meta">
                  {formatDate(session.started_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
