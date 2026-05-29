import { useState, useEffect } from 'react'

interface LearningState {
  currentSessionId: number | null
  studyDay: string
  currentTask: string
  teacherMode: string
  activeBlockId: number | null
  activeTask: { task_type: string; status: string } | null
  persistencePolicy: string
}

interface VocabStats {
  wordCount: number
  progressStats: { total: number; byStatus: Record<string, number> }
}

interface WeeklyReview {
  id: number
  week_start: string
  week_end: string
  summary: string
  overall_score: number | null
  created_at: string
}

interface MigrationStatus {
  applied: Array<{ version: number; name: string; applied_at: string }>
  totalApplied: number
}

interface TokenStats {
  requestCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export default function DashboardPage() {
  const [learningState, setLearningState] = useState<LearningState | null>(null)
  const [vocabStats, setVocabStats] = useState<VocabStats | null>(null)
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([])
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [state, stats, reviews, migrations, health, tokens] = await Promise.all([
          window.appApi.getCurrentLearningState().catch(e => { console.error('getCurrentLearningState failed:', e); return null }),
          window.appApi.getVocabStats().catch(e => { console.error('getVocabStats failed:', e); return null }),
          window.appApi.getRecentWeeklyReviews(5).catch(e => { console.error('getRecentWeeklyReviews failed:', e); return [] }),
          window.appApi.getMigrationStatus().catch(e => { console.error('getMigrationStatus failed:', e); return null }),
          window.appApi.checkDatabaseIntegrity().catch(e => { console.error('checkDatabaseIntegrity failed:', e); return { ok: false, message: String(e), checkedAt: new Date().toISOString() } }),
          window.appApi.getTodayTokenStats().catch(e => { console.error('getTodayTokenStats failed:', e); return null })
        ])
        setLearningState(state)
        setVocabStats(stats)
        setWeeklyReviews(reviews)
        setMigrationStatus(migrations)
        setHealthOk(health?.ok ?? false)
        setTokenStats(tokens)
        setError(null)
      } catch (e) {
        console.error('Dashboard load failed:', e)
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  const handleBackup = async () => {
    const result = await window.appApi.createBackup('manual')
    if (result.success) {
      alert(`备份已创建: ${result.backupPath}`)
    } else {
      alert(`备份失败: ${result.error}`)
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>仪表盘</h2>
      </div>

      <div className="dashboard-content">
        {error && (
          <div className="dashboard-error" style={{ padding: '12px', marginBottom: '16px', background: '#fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '14px' }}>
            加载出错: {error}
          </div>
        )}
        {/* Learning State */}
        <section className="dashboard-section">
          <h3>学习状态</h3>
          {!loaded ? (
            <div className="stat-empty">加载中...</div>
          ) : learningState ? (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">学习日</div>
                <div className="stat-value">{learningState.studyDay}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">当前任务</div>
                <div className="stat-value">{learningState.currentTask === 'idle' ? '空闲' : learningState.currentTask}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">教师模式</div>
                <div className="stat-value">{learningState.teacherMode === 'chat' ? '对话' : learningState.teacherMode}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">活跃学习块</div>
                <div className="stat-value">{learningState.activeBlockId ? `#${learningState.activeBlockId}` : '无'}</div>
              </div>
            </div>
          ) : (
            <div className="stat-empty">无法获取学习状态</div>
          )}
        </section>

        {/* Vocabulary Stats */}
        <section className="dashboard-section">
          <h3>词汇</h3>
          {!loaded ? (
            <div className="stat-empty">加载中...</div>
          ) : vocabStats ? (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">总词数</div>
                <div className="stat-value">{vocabStats.wordCount}</div>
              </div>
              {Object.entries(vocabStats.progressStats.byStatus).map(([status, count]) => (
                <div className="stat-card" key={status}>
                  <div className="stat-label">{status}</div>
                  <div className="stat-value">{count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="stat-empty">无法获取词汇数据</div>
          )}
        </section>

        {/* Token Usage */}
        <section className="dashboard-section">
          <h3>今日 Tokens 用量</h3>
          {!loaded ? (
            <div className="stat-empty">加载中...</div>
          ) : tokenStats ? (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">请求次数</div>
                <div className="stat-value">{tokenStats.requestCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">输入 Tokens</div>
                <div className="stat-value">{tokenStats.inputTokens.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">输出 Tokens</div>
                <div className="stat-value">{tokenStats.outputTokens.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">总 Tokens</div>
                <div className="stat-value">{tokenStats.totalTokens.toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="stat-empty">无法获取 Token 数据</div>
          )}
        </section>

        {/* Weekly Reviews */}
        <section className="dashboard-section">
          <h3>每周复习</h3>
          <button
            className="generate-review-btn"
            onClick={async () => {
              try {
                const now = new Date()
                const dayOfWeek = now.getDay()
                const monday = new Date(now)
                monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
                const sunday = new Date(monday)
                sunday.setDate(monday.getDate() + 6)
                const weekStart = monday.toISOString().split('T')[0]
                const weekEnd = sunday.toISOString().split('T')[0]
                await window.appApi.createWeeklyReview({
                  weekStart,
                  weekEnd,
                  summary: '手动生成的周复盘',
                  strengths: [],
                  recommendations: []
                })
                // Reload reviews
                const reviews = await window.appApi.getRecentWeeklyReviews(5)
                setWeeklyReviews(reviews)
              } catch (err) {
                console.error('Failed to generate weekly review:', err)
              }
            }}
          >
            生成本周复盘
          </button>
          {weeklyReviews.length > 0 ? (
            <div className="review-list">
              {weeklyReviews.map(review => (
                <div className="review-card" key={review.id}>
                  <div className="review-header">
                    <span className="review-dates">{review.week_start} ~ {review.week_end}</span>
                    {review.overall_score !== null && (
                      <span className="review-score">{review.overall_score}/100</span>
                    )}
                  </div>
                  <div className="review-summary">{review.summary}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="stat-empty">暂无每周复习记录</div>
          )}
        </section>

        {/* System Health */}
        <section className="dashboard-section">
          <h3>系统</h3>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">数据库健康</div>
              <div className={`stat-value ${healthOk === true ? 'text-ok' : healthOk === false ? 'text-error' : ''}`}>
                {!loaded ? '检查中...' : healthOk ? '正常' : '发现问题'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">迁移版本</div>
              <div className="stat-value">{!loaded ? '...' : migrationStatus ? `已应用 ${migrationStatus.totalApplied} 个` : '获取失败'}</div>
            </div>
          </div>
          <button className="backup-button" onClick={handleBackup}>创建备份</button>
        </section>
      </div>
    </div>
  )
}
