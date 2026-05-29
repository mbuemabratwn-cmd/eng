import { DailyTargetPoolRepository, DailyTargetPool } from '../repositories/daily-target-pool.repository'
import { ReviewLoadManager } from './review-load-manager'
import { LearningStateManager } from './learning-state-manager'

export interface TargetPoolConfig {
  recommendedMinutes: number
  baseNewWordCount: number
  focusedWordCount: number
  targetType: string
}

const DEFAULT_CONFIG: TargetPoolConfig = {
  recommendedMinutes: 60,
  baseNewWordCount: 50,
  focusedWordCount: 20,
  targetType: 'vocabulary'
}

export class DailyTargetPoolManager {
  constructor(
    private poolRepo: DailyTargetPoolRepository,
    private reviewLoadManager: ReviewLoadManager,
    private stateManager: LearningStateManager
  ) {}

  getOrCreateTodayPool(config?: Partial<TargetPoolConfig>): DailyTargetPool {
    const studyDay = this.stateManager.getState().study_day
    const existing = this.poolRepo.getActive(studyDay)
    if (existing) {
      return existing
    }

    return this.generatePool(studyDay, config)
  }

  generatePool(studyDay: string, config?: Partial<TargetPoolConfig>): DailyTargetPool {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }

    // Adjust new word count based on review load
    const adjustedNewWordCount = this.reviewLoadManager.calculateAdjustedNewWordCount(mergedConfig.baseNewWordCount)

    // Get review word count (words due for review)
    const reviewLoadInfo = this.reviewLoadManager.getReviewLoad()

    const pool = this.poolRepo.create({
      study_day: studyDay,
      recommended_minutes: mergedConfig.recommendedMinutes,
      new_word_count: adjustedNewWordCount,
      focused_word_count: mergedConfig.focusedWordCount,
      review_word_count: reviewLoadInfo.dueReviewCount,
      target_type: mergedConfig.targetType,
      status: 'active',
      metadata: JSON.stringify({
        reviewLoadLevel: this.reviewLoadManager.getLoadLevel(),
        reviewLoadRatio: reviewLoadInfo.reviewLoadRatio,
        baseNewWordCount: mergedConfig.baseNewWordCount,
        adjustedNewWordCount,
        reductionReason: reviewLoadInfo.recommendedNewWordReduction > 0
          ? `复习负荷为 ${Math.round(reviewLoadInfo.reviewLoadRatio * 100)}%`
          : null
      })
    })

    return pool
  }

  getCurrentPool(): DailyTargetPool | null {
    const studyDay = this.stateManager.getState().study_day
    return this.poolRepo.getActive(studyDay)
  }

  updatePoolProgress(poolId: number, updates: {
    completedNewWords?: number
    completedReviewWords?: number
    completedFocusedWords?: number
  }): void {
    const pool = this.poolRepo.getById(poolId)
    if (!pool) return

    const metadata = pool.metadata ? JSON.parse(pool.metadata) : {}
    const updatedMetadata = {
      ...metadata,
      ...updates,
      lastUpdated: new Date().toISOString()
    }

    this.poolRepo.update(poolId, {
      metadata: JSON.stringify(updatedMetadata)
    })
  }

  markPoolCompleted(poolId: number): void {
    this.poolRepo.markCompleted(poolId)
  }

  getRecentPools(limit = 7): DailyTargetPool[] {
    return this.poolRepo.getRecent(limit)
  }

  getPoolSummary(pool: DailyTargetPool): {
    studyDay: string
    recommendedMinutes: number
    newWords: { target: number; completed: number }
    focusedWords: { target: number; completed: number }
    reviewWords: { target: number; completed: number }
    status: string
  } {
    const metadata = pool.metadata ? JSON.parse(pool.metadata) : {}

    return {
      studyDay: pool.study_day,
      recommendedMinutes: pool.recommended_minutes,
      newWords: {
        target: pool.new_word_count,
        completed: metadata.completedNewWords || 0
      },
      focusedWords: {
        target: pool.focused_word_count,
        completed: metadata.completedFocusedWords || 0
      },
      reviewWords: {
        target: pool.review_word_count,
        completed: metadata.completedReviewWords || 0
      },
      status: pool.status
    }
  }
}
