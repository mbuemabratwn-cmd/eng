import { useState, useEffect } from 'react'

interface VocabWord {
  id: number
  word: string
  phonetic: string | null
  part_of_speech: string | null
  chinese_meaning: string | null
  english_meaning: string | null
  difficulty_level: number
  exam_tags: string | null
  source: string | null
}

interface VocabProgress {
  id: number
  word_id: number
  status: string
  mastery_score: number
  recognition_score: number
  recall_score: number
  context_score: number
  usage_score: number
  correct_count: number
  mistake_count: number
  review_count: number
  last_seen_at: string | null
  next_review_at: string | null
  interval_days: number
  ease_factor: number
  last_result: string | null
}

interface VocabAiNote {
  id: number
  word_id: number
  ai_explanation_cn: string | null
  ai_explanation_en: string | null
  ai_examples: string | null
  exam_usage: string | null
  common_collocations: string | null
  common_mistakes: string | null
  synonyms: string | null
  antonyms: string | null
  memory_tips: string | null
}

interface VocabData {
  word: VocabWord
  progress: VocabProgress | null
  aiNote: VocabAiNote | null
  recentReviews: Array<{
    id: number
    word_id: number
    mode: string | null
    question_type: string | null
    is_correct: number | null
    score: number | null
    created_at: string
  }>
}

interface VocabDetailCardProps {
  word: string
  onClose?: () => void
}

export default function VocabDetailCard({ word, onClose }: VocabDetailCardProps) {
  const [data, setData] = useState<VocabData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const result = await window.appApi.getVocabProgressInfoByText(word)
        setData(result)
      } catch (err) {
        console.error('Failed to load vocab info:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [word])

  if (loading) {
    return (
      <div className="vocab-detail-card">
        <div className="vocab-loading">加载中...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="vocab-detail-card">
        <div className="vocab-empty">未找到词汇信息</div>
      </div>
    )
  }

  const { word: wordInfo, progress, aiNote } = data

  return (
    <div className="vocab-detail-card">
      <div className="vocab-header">
        <div className="vocab-word">{wordInfo.word}</div>
        {onClose && (
          <button className="vocab-close" onClick={onClose}>×</button>
        )}
      </div>

      <div className="vocab-body">
        {wordInfo.phonetic && (
          <div className="vocab-phonetic">{wordInfo.phonetic}</div>
        )}

        {wordInfo.part_of_speech && (
          <div className="vocab-pos">{wordInfo.part_of_speech}</div>
        )}

        {wordInfo.chinese_meaning && (
          <div className="vocab-section">
            <div className="vocab-section-label">中文释义</div>
            <div className="vocab-meaning">{wordInfo.chinese_meaning}</div>
          </div>
        )}

        {wordInfo.english_meaning && (
          <div className="vocab-section">
            <div className="vocab-section-label">英文释义</div>
            <div className="vocab-meaning">{wordInfo.english_meaning}</div>
          </div>
        )}

        {aiNote?.ai_examples && (
          <div className="vocab-section">
            <div className="vocab-section-label">例句</div>
            <div className="vocab-example">{aiNote.ai_examples}</div>
          </div>
        )}

        {aiNote?.common_collocations && (
          <div className="vocab-section">
            <div className="vocab-section-label">搭配</div>
            <div className="vocab-collocations">{aiNote.common_collocations}</div>
          </div>
        )}

        {aiNote?.synonyms && (
          <div className="vocab-section">
            <div className="vocab-section-label">同义词</div>
            <div className="vocab-synonyms">{aiNote.synonyms}</div>
          </div>
        )}

        {aiNote?.antonyms && (
          <div className="vocab-section">
            <div className="vocab-section-label">反义词</div>
            <div className="vocab-antonyms">{aiNote.antonyms}</div>
          </div>
        )}

        {aiNote?.memory_tips && (
          <div className="vocab-section">
            <div className="vocab-section-label">记忆技巧</div>
            <div className="vocab-tips">{aiNote.memory_tips}</div>
          </div>
        )}

        {progress && (
          <div className="vocab-stats">
            <span className="vocab-status">状态: {progress.status}</span>
            <span className="vocab-review-count">复习次数: {progress.review_count}</span>
            {progress.review_count > 0 && (
              <span className="vocab-accuracy">
                正确率: {Math.round((progress.correct_count / progress.review_count) * 100)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
