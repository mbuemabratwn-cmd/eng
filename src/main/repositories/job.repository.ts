import { BaseRepository } from './base'

export interface Job {
  id: number
  type: string
  payload: string | null
  status: string
  attempts: number
  max_attempts: number
  error: string | null
  resource_key: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export class JobRepository extends BaseRepository {
  create(type: string, payload?: string, resourceKey?: string): Job {
    const now = this.now()
    const result = this.db.prepare(
      'INSERT INTO jobs (type, payload, status, resource_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(type, payload || null, 'pending', resourceKey || null, now, now)
    return this.getJob(result.lastInsertRowid as number)!
  }

  getJob(id: number): Job | null {
    return this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | null
  }

  getByStatus(status: string, limit = 50): Job[] {
    return this.db.prepare(
      'SELECT * FROM jobs WHERE status = ? ORDER BY created_at LIMIT ?'
    ).all(status, limit) as Job[]
  }

  claimNext(type: string): Job | null {
    const now = this.now()
    const job = this.db.prepare(
      'SELECT * FROM jobs WHERE status = ? AND type = ? ORDER BY created_at LIMIT 1'
    ).get('pending', type) as Job | undefined

    if (!job) return null

    this.db.prepare(
      'UPDATE jobs SET status = ?, started_at = ?, updated_at = ?, attempts = attempts + 1 WHERE id = ?'
    ).run('running', now, now, job.id)

    return this.getJob(job.id)!
  }

  markDone(id: number): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE jobs SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
    ).run('done', now, now, id)
  }

  markFailed(id: number, error: string): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?'
    ).run('failed', error, now, id)
  }

  markCancelled(id: number): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?'
    ).run('cancelled', now, id)
  }

  retryFailed(id: number): void {
    const now = this.now()
    this.db.prepare(
      'UPDATE jobs SET status = ?, error = NULL, updated_at = ? WHERE id = ? AND status = ?'
    ).run('pending', now, id, 'failed')
  }

  getByResourceKey(resourceKey: string): Job | null {
    return this.db.prepare(
      'SELECT * FROM jobs WHERE resource_key = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1'
    ).get(resourceKey, 'pending', 'running') as Job | null
  }
}
