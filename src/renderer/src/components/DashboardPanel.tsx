import { useState, useEffect } from 'react'

interface LearningStats {
  todayMinutes: number
  totalMinutes: number
  wordCount: number
  sentenceCount: number
  currentStreak: number
}

interface DashboardPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function DashboardPanel({ collapsed, onToggleCollapse }: DashboardPanelProps) {
  const [stats, setStats] = useState<LearningStats>({
    todayMinutes: 0,
    totalMinutes: 0,
    wordCount: 0,
    sentenceCount: 0,
    currentStreak: 0
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const [vocabStats, sentenceStats] = await Promise.all([
        window.appApi.getVocabStats(),
        window.appApi.getSentenceStats()
      ])

      setStats({
        todayMinutes: 0, // TODO: Calculate from learning blocks
        totalMinutes: 0, // TODO: Calculate from all blocks
        wordCount: vocabStats.wordCount,
        sentenceCount: sentenceStats.sentenceCount,
        currentStreak: 0 // TODO: Calculate streak
      })
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (collapsed) {
    return (
      <div className="dashboard-panel collapsed">
        <button className="dashboard-toggle" onClick={onToggleCollapse} title="展开仪表盘">
          📊
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <h3>学习概览</h3>
        <button className="dashboard-toggle" onClick={onToggleCollapse} title="收起仪表盘">
          ✕
        </button>
      </div>

      <div className="panel-content">
        {loading ? (
          <div className="panel-loading">加载中...</div>
        ) : (
          <>
            <div className="stat-item">
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <div className="stat-value">{stats.todayMinutes}</div>
                <div className="stat-label">今日学习（分钟）</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">📚</div>
              <div className="stat-info">
                <div className="stat-value">{stats.wordCount}</div>
                <div className="stat-label">词汇量</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">📝</div>
              <div className="stat-info">
                <div className="stat-value">{stats.sentenceCount}</div>
                <div className="stat-label">长难句</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">🔥</div>
              <div className="stat-info">
                <div className="stat-value">{stats.currentStreak}</div>
                <div className="stat-label">连续学习天数</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
