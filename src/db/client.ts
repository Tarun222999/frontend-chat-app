import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const createDatabase = () => drizzle(neon(getDatabaseUrl()), {
  schema,
})

export type Database = ReturnType<typeof createDatabase>

let cachedDb: Database | null = null

const getDatabaseUrl = () => {
  const databaseUrl = process.env.NEON_DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      "Database connection string is missing. Set NEON_DATABASE_URL.",
    )
  }

  return databaseUrl
}

export const getDb = () => {
  cachedDb ??= createDatabase()

  return cachedDb
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getDb()
    const value = Reflect.get(database, property)

    return typeof value === "function" ? value.bind(database) : value
  },
})
