export interface Migration {
  version: number
  name: string
  checksum?: string
  sql: string
}

import { migration001 } from './001_initial_schema'
import { migration002 } from './002_vocabulary_schema'
import { migration003 } from './003_daily_target_pool'
import { migration004 } from './004_long_sentences'
import { migration005 } from './005_grammar'
import { migration006 } from './006_summary_memory'
import { migration007 } from './007_file_ingestion'
import { migration008 } from './008_fsrs_fields'

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008
]
