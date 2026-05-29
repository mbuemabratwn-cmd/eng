import { useState, useEffect } from 'react'
import TeachingFormatBadge from './TeachingFormatBadge'

interface LearningState {
  currentSessionId: number | null
  studyDay: string
  currentTask: string
  teacherMode: string
  activeBlockId: number | null
  activeTask: { task_type: string; status: string; theme?: string } | null
  persistencePolicy: string
}

const TASK_LABELS: Record<string, string> = {
  word_theme_learning: '词汇主题课',
  word_review: '词汇复习',
  long_sentence: '长难句',
  grammar_correction: '语法纠错',
  free_chat: '自由对话',
  daily_plan: '今日计划',
  summary: '总结中',
  weekly_review: '周复习',
  file_processing: '文件处理',
  none: '空闲'
}

const MODE_LABELS: Record<string, string> = {
  guide: '引导',
  explain: '讲解',
  answer: '解答',
  review: '复习',
  chat: '对话'
}

// Map task types to teaching formats
const TASK_TEACHING_FORMAT: Record<string, string> = {
  word_theme_learning: '知识分享',
  word_review: '讨论',
  long_sentence: '考研短文',
  grammar_correction: '易混词对比',
  free_chat: '故事'
}

export default function LearningStatusBar() {
  const [state, setState] = useState<LearningState | null>(null)

  useEffect(() => {
    const load = async () => {
      const s = await window.appApi.getCurrentLearningState()
      setState(s)
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!state) return null

  const isActive = state.activeBlockId !== null
  const taskLabel = TASK_LABELS[state.currentTask] || state.currentTask
  const modeLabel = MODE_LABELS[state.teacherMode] || state.teacherMode
  const teachingFormat = TASK_TEACHING_FORMAT[state.currentTask]

  return (
    <div className="learning-status-bar">
      <span className={`status-dot ${isActive ? 'status-active' : 'status-idle'}`} />
      <span className="status-text">
        {isActive ? `${taskLabel} · ${modeLabel}` : '未在学习'}
      </span>
      {isActive && teachingFormat && (
        <TeachingFormatBadge format={teachingFormat} />
      )}
      {state.persistencePolicy === 'transient_only' && (
        <span className="status-badge status-transient">临时</span>
      )}
    </div>
  )
}
