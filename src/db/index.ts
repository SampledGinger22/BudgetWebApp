import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import * as schema from './schema'

const databaseUrl = process.env.DATABASE_URL!

function createDb() {
  // Neon endpoints contain '.neon.tech' in the hostname
  if (databaseUrl.includes('.neon.tech')) {
    const sql = neon(databaseUrl)
    return drizzleNeon(sql, { schema })
  }
  // Local / standard Postgres via node-postgres
  const pool = new pg.Pool({ connectionString: databaseUrl })
  return drizzlePg(pool, { schema })
}

export const db = createDb()
export type Database = typeof db
