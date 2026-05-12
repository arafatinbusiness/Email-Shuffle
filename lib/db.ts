import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL

export function getDb() {
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return neon(connectionString)
}

export const sql = connectionString ? neon(connectionString) : null
