import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.NEON_DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    "Database connection string is missing. Set NEON_DATABASE_URL.",
  )
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
})
