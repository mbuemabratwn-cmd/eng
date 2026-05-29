import { useState, useEffect } from 'react'

interface WeeklyReview {
  id: number
  week_start: string
  week_end: string
  summary: string
  strengths: string | null
  weaknesses: string | null
  recommendations: string | null
  overall_score: number | null
  created_at: string
}

interface WeeklyReviewViewProps {
  weekStart?: string
  onClose?: () => void
}

export default function WeeklyReviewView({ weekStart, onClose }: WeeklyReviewViewProps) {
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [recentReviews, setRecentReviews] = useState<Array<{
    id: number
    week_start: string
    week_end: string
    summary: string
    overall_score: number | null
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState<string | null>(weekStart || null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedWeek) {
      loadReview(selectedWeek)
    }
  }, [selectedWeek])

  const loadData = async () => {
    try {
      const reviews = await window.appApi.getRecentWeeklyReviews(4)
      setRecentReviews(reviews)
      if (reviews.length > 0 && !selectedWeek) {
        setSelectedWeek(reviews[0].week_start)
      }
    } catch (err) {
      console.error('Failed to load weekly reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadReview = async (weekStart: string) => {
    try {
      const data = await window.appApi.getWeeklyReview(weekStart)
      setReview(data)
    } catch (err) {
      console.error('Failed to load weekly review:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric'
    })
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#666'
    if (score >= 80) return '#28a745'
    if (score >= 60) return '#ffc107'
    return '#dc3545'
  }

  if (loading) {
    return (
      <div className="weekly-review-view">
        <div className="review-loading">加载中...</div>
      </div>
    )
  }

  if (recentReviews.length === 0) {
    return (
      <div className="weekly-review-view">
        <div className="review-empty">暂无周复盘数据</div>
      </div>
    )
  }

  return (
    <div className="weekly-review-view">
      <div className="review-header">
        <h3>周复盘</h3>
        {onClose && (
          <button className="review-close" onClick={onClose}>×</button>
        )}
      </div>

      <div className="review-week-selector">
        {recentReviews.map((r) => (
          <button
            key={r.id}
            className={`week-button ${selectedWeek === r.week_start ? 'active' : ''}`}
            onClick={() => setSelectedWeek(r.week_start)}
          >
            {formatDate(r.week_start)} - {formatDate(r.week_end)}
          </button>
        ))}
      </div>

      {review && (
        <div className="review-content">
          {review.overall_score !== null && (
            <div className="review-score-section">
              <div className="score-label">综合评分</div>
              <div
                className="score-value"
                style={{ color: getScoreColor(review.overall_score) }}
              >
                {review.overall_score}
              </div>
            </div>
          )}

          <div className="review-section">
            <h4>本周总结</h4>
            <p>{review.summary}</p>
          </div>

          {review.strengths && (
            <div className="review-section">
              <h4>优势</h4>
              <ul>
                {JSON.parse(review.strengths).map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {review.weaknesses && (
            <div className="review-section">
              <h4>待改进</h4>
              <ul>
                {JSON.parse(review.weaknesses).map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {review.recommendations && (
            <div className="review-section">
              <h4>下周建议</h4>
              <ul>
                {JSON.parse(review.recommendations).map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="review-meta">
            生成于 {new Date(review.created_at).toLocaleString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  )
}
