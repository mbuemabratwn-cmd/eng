import { useState, useEffect, useRef } from 'react'

interface LearningTimerProps {
  sessionId: number | null
}

export default function LearningTimer({ sessionId }: LearningTimerProps) {
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [todaySeconds, setTodaySeconds] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<Date | null>(null)

  useEffect(() => {
    if (sessionId) {
      startTimeRef.current = new Date()
      setSessionSeconds(0)

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
          setSessionSeconds(elapsed)
          setTodaySeconds(prev => prev + 1)
        }
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      startTimeRef.current = null
      setSessionSeconds(0)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [sessionId])

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="learning-timer">
      <div className="timer-item">
        <span className="timer-icon">⏱️</span>
        <span className="timer-label">本次学习</span>
        <span className="timer-value">{formatTime(sessionSeconds)}</span>
      </div>
      <div className="timer-item">
        <span className="timer-icon">📅</span>
        <span className="timer-label">今日累计</span>
        <span className="timer-value">{formatTime(todaySeconds)}</span>
      </div>
    </div>
  )
}
