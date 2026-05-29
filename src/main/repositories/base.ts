import Database from 'better-sqlite3'

export abstract class BaseRepository {
  protected db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  protected now(): string {
    return new Date().toISOString()
  }
}
