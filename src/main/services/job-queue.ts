import { JobRepository, Job } from '../repositories/job.repository'

export type JobHandler = (payload: string) => Promise<void>

export class JobQueue {
  private repo: JobRepository
  private handlers = new Map<string, JobHandler>()
  private processing = false
  private pollInterval: NodeJS.Timeout | null = null

  constructor(repo: JobRepository) {
    this.repo = repo
  }

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler)
  }

  enqueue(type: string, payload?: string, resourceKey?: string): Job {
    // Check for existing pending/running job with same resource key
    if (resourceKey) {
      const existing = this.repo.getByResourceKey(resourceKey)
      if (existing) return existing
    }
    return this.repo.create(type, payload, resourceKey)
  }

  start(intervalMs = 1000): void {
    if (this.pollInterval) return
    this.pollInterval = setInterval(() => this.processNext(), intervalMs)
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  async processNext(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      for (const [type, handler] of this.handlers) {
        const job = this.repo.claimNext(type)
        if (!job) continue

        try {
          await handler(job.payload || '')
          this.repo.markDone(job.id)
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          if (job.attempts >= job.max_attempts) {
            this.repo.markFailed(job.id, error)
          } else {
            // Reset to pending for retry
            this.repo.retryFailed(job.id)
          }
        }
      }
    } finally {
      this.processing = false
    }
  }

  getJob(id: number): Job | null {
    return this.repo.getJob(id)
  }

  getPendingJobs(): Job[] {
    return this.repo.getByStatus('pending')
  }

  getFailedJobs(): Job[] {
    return this.repo.getByStatus('failed')
  }

  retryJob(id: number): void {
    this.repo.retryFailed(id)
  }
}
