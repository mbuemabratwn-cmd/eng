/**
 * FSRS (Free Spaced Repetition Scheduler) implementation
 *
 * Based on the FSRS v4 algorithm for spaced repetition.
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki
 *
 * States: 0=New, 1=Learning, 2=Review, 3=Relearning
 * Grades: 0=Again, 1=Hard, 2=Good, 3=Easy
 */

export type FSRSGrade = 0 | 1 | 2 | 3

export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}

export interface FSRSParameters {
  w: number[]  // 19 model weights
  requestRetention: number  // Target retention rate (0.85-0.95)
  maximumInterval: number   // Maximum interval in days
}

export interface FSRSItem {
  difficulty: number   // 0-1
  stability: number    // in days
  retrievability: number  // 0-1
  state: FSRSState
  elapsedDays: number  // days since last review
  scheduledDays: number  // scheduled interval
  lastReviewAt: Date | null
}

export interface FSRSResult {
  difficulty: number
  stability: number
  retrievability: number
  state: FSRSState
  scheduledDays: number
  nextReviewAt: Date
}

// Default FSRS v4 parameters
const DEFAULT_PARAMETERS: FSRSParameters = {
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01,
    1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29,
    2.61, 0.0, 0.0
  ],
  requestRetention: 0.9,
  maximumInterval: 365
}

export class FSRSScheduler {
  private params: FSRSParameters

  constructor(params?: Partial<FSRSParameters>) {
    this.params = { ...DEFAULT_PARAMETERS, ...params }
  }

  /**
   * Schedule a card based on grade and current state
   */
  schedule(item: FSRSItem, grade: FSRSGrade, now: Date = new Date()): FSRSResult {
    const { w } = this.params

    // Calculate retrievability from last review
    const retrievability = item.lastReviewAt
      ? this.forgettingCurve(item.elapsedDays, item.stability)
      : 1.0

    let newDifficulty = item.difficulty
    let newStability = item.stability
    let newState = item.state
    let scheduledDays = 0

    if (item.state === FSRSState.New) {
      // First review
      newDifficulty = this.initDifficulty(grade)
      newStability = this.initStability(grade)
      newState = grade === 0 ? FSRSState.Learning : FSRSState.Review
      scheduledDays = this.calculateInterval(newStability)
    } else if (item.state === FSRSState.Learning || item.state === FSRSState.Relearning) {
      // In learning phase
      if (grade === 0) {
        // Again - stay in learning
        newDifficulty = this.nextDifficulty(item.difficulty, grade)
        newStability = this.nextForgetStability(item.difficulty, item.stability, retrievability)
        newState = item.state
        scheduledDays = 0  // Review immediately
      } else if (grade === 1) {
        // Hard - stay in learning
        newDifficulty = this.nextDifficulty(item.difficulty, grade)
        newStability = this.shortTermStability(item.stability, grade)
        newState = item.state
        scheduledDays = 1
      } else if (grade === 2) {
        // Good - move to review
        newDifficulty = this.nextDifficulty(item.difficulty, grade)
        newStability = this.shortTermStability(item.stability, grade)
        newState = FSRSState.Review
        scheduledDays = this.calculateInterval(newStability)
      } else {
        // Easy - move to review
        newDifficulty = this.nextDifficulty(item.difficulty, grade)
        newStability = this.shortTermStability(item.stability, grade)
        newState = FSRSState.Review
        scheduledDays = this.calculateInterval(newStability) * 1.3
      }
    } else {
      // In review phase
      if (grade === 0) {
        // Again - back to relearning
        newDifficulty = this.nextDifficulty(item.difficulty, grade)
        newStability = this.nextForgetStability(item.difficulty, item.stability, retrievability)
        newState = FSRSState.Relearning
        scheduledDays = 0
      } else {
        // Hard/Good/Easy - stay in review
        newDifficulty = this.nextDifficulty(item.difficulty, grade)
        newStability = this.nextRecallStability(item.difficulty, item.stability, retrievability, grade)
        newState = FSRSState.Review
        scheduledDays = this.calculateInterval(newStability)
      }
    }

    // Clamp values
    newDifficulty = Math.max(0, Math.min(1, newDifficulty))
    newStability = Math.max(0.01, newStability)
    scheduledDays = Math.max(0, Math.min(this.params.maximumInterval, Math.round(scheduledDays)))

    const nextReviewAt = new Date(now)
    nextReviewAt.setDate(nextReviewAt.getDate() + scheduledDays)

    return {
      difficulty: newDifficulty,
      stability: newStability,
      retrievability: this.forgettingCurve(scheduledDays, newStability),
      state: newState,
      scheduledDays,
      nextReviewAt
    }
  }

  /**
   * Calculate retrievability using forgetting curve
   * R(t,S) = (1 + t/(9*S))^(-1)
   */
  private forgettingCurve(elapsedDays: number, stability: number): number {
    return Math.pow(1 + elapsedDays / (9 * stability), -1)
  }

  /**
   * Initialize difficulty from first grade
   * D_0(G) = w_0 - e^(G * w_1) + 1
   */
  private initDifficulty(grade: number): number {
    const { w } = this.params
    return w[0] - Math.exp(grade * w[1]) + 1
  }

  /**
   * Initialize stability from first grade
   * S_0(G) = w_2 * e^(G * w_3) + w_4
   */
  private initStability(grade: number): number {
    const { w } = this.params
    return w[2] * Math.exp(grade * w[3]) + w[4]
  }

  /**
   * Calculate next difficulty after a review
   * D'(D,G) = w_5 * D_0(0) + (1 - w_5) * (D - w_6 * (G - 1))
   */
  private nextDifficulty(currentDifficulty: number, grade: number): number {
    const { w } = this.params
    const d0 = this.initDifficulty(0)  // D_0(0) = w[0] - 1 + 1 = w[0]
    const delta = grade === 0 ? -1 : (grade - 1)
    return w[5] * d0 + (1 - w[5]) * (currentDifficulty - w[6] * delta)
  }

  /**
   * Calculate short-term stability (for learning cards)
   * S_sh(D,S,G) = S * e^(w_7 * (G - 3 + w_8))
   */
  private shortTermStability(currentStability: number, grade: number): number {
    const { w } = this.params
    return currentStability * Math.exp(w[7] * (grade - 3 + w[8]))
  }

  /**
   * Calculate next stability for successful recall
   * S'_S(D,S,R,G) = S * (e^(w_9) * (11 - D) * S^(-w_10) * (e^(w_11 * (1-R)) - 1) * hardPenalty + 1)
   */
  private nextRecallStability(
    difficulty: number,
    currentStability: number,
    retrievability: number,
    grade: number
  ): number {
    const { w } = this.params

    // Hard penalty
    const hardPenalty = grade === 1 ? w[15] : 1

    // Easy bonus
    const easyBonus = grade === 3 ? w[16] : 1

    const stabilityFactor = Math.exp(w[9]) *
      (11 - difficulty) *
      Math.pow(currentStability, -w[10]) *
      (Math.exp(w[11] * (1 - retrievability)) - 1)

    return currentStability * (stabilityFactor * hardPenalty * easyBonus + 1)
  }

  /**
   * Calculate stability after forgetting
   * S'_F(D,S,R) = w_12 * D^(-w_13) * ((S+1)^w_14 - 1) * e^(w_15 * (1-R))
   */
  private nextForgetStability(
    difficulty: number,
    currentStability: number,
    retrievability: number
  ): number {
    const { w } = this.params
    return w[12] *
      Math.pow(difficulty, -w[13]) *
      (Math.pow(currentStability + 1, w[14]) - 1) *
      Math.exp(w[15] * (1 - retrievability))
  }

  /**
   * Calculate interval from stability
   * I(S) = S * (1/R - 1) * requestRetention_factor
   */
  private calculateInterval(stability: number): number {
    const { requestRetention } = this.params
    return stability * (1 / requestRetention - 1)
  }

  /**
   * Convert a review quality (0-1) to FSRS grade (0-3)
   */
  static qualityToGrade(quality: number, isCorrect: boolean): FSRSGrade {
    if (!isCorrect) return 0  // Again
    if (quality >= 0.9) return 3  // Easy
    if (quality >= 0.6) return 2  // Good
    return 1  // Hard
  }

  /**
   * Get interval hint for display purposes
   */
  getNextIntervalHint(item: FSRSItem, grade: FSRSGrade): string {
    const result = this.schedule(item, grade)
    const days = result.scheduledDays

    if (days === 0) return '立即'
    if (days === 1) return '1天后'
    if (days < 7) return `${days}天后`
    if (days < 30) return `${Math.round(days / 7)}周后`
    if (days < 365) return `${Math.round(days / 30)}月后`
    return `${Math.round(days / 365)}年后`
  }
}
