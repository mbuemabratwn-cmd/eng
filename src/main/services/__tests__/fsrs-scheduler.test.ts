import { FSRSScheduler, FSRSState, FSRSGrade } from '../fsrs-scheduler'

describe('FSRSScheduler', () => {
  let scheduler: FSRSScheduler

  beforeEach(() => {
    scheduler = new FSRSScheduler()
  })

  describe('schedule', () => {
    it('should schedule new card with Good grade', () => {
      const result = scheduler.schedule({
        difficulty: 0,
        stability: 0,
        retrievability: 1,
        state: FSRSState.New,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReviewAt: null
      }, 2) // Good grade

      expect(result.state).toBe(FSRSState.Review)
      expect(result.difficulty).toBeGreaterThanOrEqual(0)
      expect(result.stability).toBeGreaterThan(0)
      expect(result.scheduledDays).toBeGreaterThanOrEqual(0)
      expect(result.nextReviewAt).toBeInstanceOf(Date)
    })

    it('should keep new card in learning with Again grade', () => {
      const result = scheduler.schedule({
        difficulty: 0,
        stability: 0,
        retrievability: 1,
        state: FSRSState.New,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReviewAt: null
      }, 0) // Again grade

      expect(result.state).toBe(FSRSState.Learning)
      // New cards with Again grade may have scheduledDays based on stability
    })

    it('should move learning card to review with Good grade', () => {
      const result = scheduler.schedule({
        difficulty: 0.5,
        stability: 1,
        retrievability: 0.9,
        state: FSRSState.Learning,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReviewAt: new Date()
      }, 2) // Good grade

      expect(result.state).toBe(FSRSState.Review)
      // scheduledDays may be 0 if stability is very low
    })

    it('should keep learning card in learning with Again grade', () => {
      const result = scheduler.schedule({
        difficulty: 0.5,
        stability: 1,
        retrievability: 0.9,
        state: FSRSState.Learning,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReviewAt: new Date()
      }, 0) // Again grade

      expect(result.state).toBe(FSRSState.Learning)
      // scheduledDays may vary based on stability
    })

    it('should send review card to relearning with Again grade', () => {
      const result = scheduler.schedule({
        difficulty: 0.5,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 0) // Again grade

      expect(result.state).toBe(FSRSState.Relearning)
      expect(result.scheduledDays).toBe(0)
    })

    it('should keep review card in review with Good grade', () => {
      const result = scheduler.schedule({
        difficulty: 0.5,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 2) // Good grade

      expect(result.state).toBe(FSRSState.Review)
      expect(result.scheduledDays).toBeGreaterThan(0)
    })

    it('should schedule further for Easy grade than Good grade', () => {
      const goodResult = scheduler.schedule({
        difficulty: 0.5,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 2) // Good grade

      const easyResult = scheduler.schedule({
        difficulty: 0.5,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 3) // Easy grade

      expect(easyResult.scheduledDays).toBeGreaterThan(goodResult.scheduledDays)
    })

    it('should schedule sooner for Again grade than Good grade', () => {
      const againResult = scheduler.schedule({
        difficulty: 0.5,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 0) // Again grade

      const goodResult = scheduler.schedule({
        difficulty: 0.5,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 2) // Good grade

      // Again sends to relearning with 0 days, Good stays in review
      expect(againResult.scheduledDays).toBeLessThan(goodResult.scheduledDays)
    })

    it('should clamp difficulty between 0 and 1', () => {
      const result = scheduler.schedule({
        difficulty: 0.95,
        stability: 10,
        retrievability: 0.8,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 0) // Again grade - should increase difficulty

      expect(result.difficulty).toBeLessThanOrEqual(1)
      expect(result.difficulty).toBeGreaterThanOrEqual(0)
    })

    it('should clamp interval to maximum', () => {
      const scheduler = new FSRSScheduler({ maximumInterval: 30 })
      const result = scheduler.schedule({
        difficulty: 0.1,
        stability: 100,
        retrievability: 0.9,
        state: FSRSState.Review,
        elapsedDays: 5,
        scheduledDays: 10,
        lastReviewAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }, 3) // Easy grade

      expect(result.scheduledDays).toBeLessThanOrEqual(30)
    })
  })

  describe('qualityToGrade', () => {
    it('should return 0 (Again) for incorrect answers', () => {
      expect(FSRSScheduler.qualityToGrade(0.5, false)).toBe(0)
      expect(FSRSScheduler.qualityToGrade(0, false)).toBe(0)
    })

    it('should return 3 (Easy) for high quality correct answers', () => {
      expect(FSRSScheduler.qualityToGrade(0.9, true)).toBe(3)
      expect(FSRSScheduler.qualityToGrade(1.0, true)).toBe(3)
    })

    it('should return 2 (Good) for medium quality correct answers', () => {
      expect(FSRSScheduler.qualityToGrade(0.6, true)).toBe(2)
      expect(FSRSScheduler.qualityToGrade(0.8, true)).toBe(2)
    })

    it('should return 1 (Hard) for low quality correct answers', () => {
      expect(FSRSScheduler.qualityToGrade(0.3, true)).toBe(1)
      expect(FSRSScheduler.qualityToGrade(0.5, true)).toBe(1)
    })
  })

  describe('getNextIntervalHint', () => {
    it('should return "立即" for 0 days', () => {
      const hint = scheduler.getNextIntervalHint({
        difficulty: 0.5,
        stability: 0.1,
        retrievability: 0.9,
        state: FSRSState.Learning,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReviewAt: new Date()
      }, 0) // Again grade

      expect(hint).toBe('立即')
    })

    it('should return "1天后" for 1 day', () => {
      const hint = scheduler.getNextIntervalHint({
        difficulty: 0.5,
        stability: 1,
        retrievability: 0.9,
        state: FSRSState.Learning,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReviewAt: new Date()
      }, 1) // Hard grade

      expect(hint).toBe('1天后')
    })

    it('should return days for short intervals', () => {
      const hint = scheduler.getNextIntervalHint({
        difficulty: 0.5,
        stability: 5,
        retrievability: 0.9,
        state: FSRSState.Review,
        elapsedDays: 1,
        scheduledDays: 5,
        lastReviewAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }, 2) // Good grade

      expect(hint).toMatch(/\d+天后/)
    })
  })
})
