import { VocabularyRepository } from '../repositories/vocabulary.repository'

export interface ReviewLoadInfo {
  dueReviewCount: number
  weakWordCount: number
  totalActiveWords: number
  reviewLoadRatio: number
  recommendedNewWordReduction: number
}

export class ReviewLoadManager {
  constructor(private vocabRepo: VocabularyRepository) {}

  getReviewLoad(): ReviewLoadInfo {
    const now = new Date().toISOString()
    const dueReviewWords = this.vocabRepo.getDueReviewWords(now, 1000)
    const weakWords = this.vocabRepo.getWeakWords(1000)
    const progressStats = this.vocabRepo.getProgressStats()

    const dueReviewCount = dueReviewWords.length
    const weakWordCount = weakWords.length
    const totalActiveWords = progressStats.total

    // Calculate review load ratio (due reviews / total active words)
    const reviewLoadRatio = totalActiveWords > 0 ? dueReviewCount / totalActiveWords : 0

    // Calculate recommended new word reduction based on review load
    let recommendedNewWordReduction = 0
    if (reviewLoadRatio > 0.5) {
      // High load: reduce by 50%
      recommendedNewWordReduction = 0.5
    } else if (reviewLoadRatio > 0.3) {
      // Medium load: reduce by 25%
      recommendedNewWordReduction = 0.25
    } else if (reviewLoadRatio > 0.15) {
      // Slight load: reduce by 10%
      recommendedNewWordReduction = 0.1
    }

    return {
      dueReviewCount,
      weakWordCount,
      totalActiveWords,
      reviewLoadRatio,
      recommendedNewWordReduction
    }
  }

  calculateAdjustedNewWordCount(baseCount: number): number {
    const loadInfo = this.getReviewLoad()
    const adjustedCount = Math.round(baseCount * (1 - loadInfo.recommendedNewWordReduction))
    // Minimum 10 new words even under heavy load
    return Math.max(10, adjustedCount)
  }

  shouldReduceNewWords(): boolean {
    const loadInfo = this.getReviewLoad()
    return loadInfo.recommendedNewWordReduction > 0
  }

  getLoadLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const loadInfo = this.getReviewLoad()
    if (loadInfo.reviewLoadRatio > 0.5) return 'critical'
    if (loadInfo.reviewLoadRatio > 0.3) return 'high'
    if (loadInfo.reviewLoadRatio > 0.15) return 'medium'
    return 'low'
  }
}
