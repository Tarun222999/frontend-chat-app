import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const databaseUrl = process.env.NEON_DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    "Database connection string is missing. Set NEON_DATABASE_URL.",
  )
}

const sql = neon(databaseUrl)

export const db = drizzle(sql, {
  schema,
})

export type Database = typeof db
