type LogLevel = "debug" | "info" | "warn" | "error" | "silent"

type LogMetadata = Record<string, unknown>

type LogWriter = (line: string, level: Exclude<LogLevel, "silent">) => void

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "body",
  "cookie",
  "encryptionkey",
  "key",
  "message",
  "password",
  "text",
  "token",
])

const REDACTED_VALUE = "[REDACTED]"

const normalizeLogLevel = (
  value: string | undefined,
  fallback: LogLevel,
): LogLevel => {
  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error" ||
    value === "silent"
  ) {
    return value
  }

  return fallback
}

const getDefaultLogLevel = (): LogLevel =>
  process.env.NODE_ENV === "production" ? "info" : "debug"

const shouldLog = (configuredLevel: LogLevel, targetLevel: LogLevel) =>
  LOG_LEVEL_SEVERITY[targetLevel] >= LOG_LEVEL_SEVERITY[configuredLevel]

const isSensitiveKey = (key: string) =>
  SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

const serializeError = (error: Error) => {
  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : undefined

  return {
    name: error.name,
    message: error.message,
    ...(status ? { status } : undefined),
    ...(process.env.NODE_ENV !== "production" && error.stack
      ? { stack: error.stack }
      : undefined),
  }
}

const redactValue = (key: string, value: unknown): unknown => {
  if (isSensitiveKey(key)) {
    return REDACTED_VALUE
  }

  if (value instanceof Error) {
    return serializeError(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue("", item))
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryKey, entryValue),
      ]),
    )
  }

  return value
}

export const redactLogMetadata = (metadata: LogMetadata = {}): LogMetadata =>
  redactValue("", metadata) as LogMetadata

export const createLogger = (input?: {
  level?: LogLevel
  service?: string
  environment?: string
  writer?: LogWriter
}) => {
  const writer: LogWriter =
    input?.writer ??
    ((line, level) => {
      if (level === "error") {
        console.error(line)
        return
      }

      if (level === "warn") {
        console.warn(line)
        return
      }

      console.log(line)
    })

  const write = (
    level: Exclude<LogLevel, "silent">,
    message: string,
    metadata?: LogMetadata,
  ) => {
    const configuredLevel = normalizeLogLevel(
      input?.level ?? process.env.LOG_LEVEL,
      getDefaultLogLevel(),
    )

    if (!shouldLog(configuredLevel, level)) {
      return
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: input?.service ?? "frontend-chat",
      environment: input?.environment ?? process.env.NODE_ENV ?? "development",
      message,
      ...(metadata ? { metadata: redactLogMetadata(metadata) } : undefined),
    }

    writer(JSON.stringify(entry), level)
  }

  return {
    debug: (message: string, metadata?: LogMetadata) =>
      write("debug", message, metadata),
    info: (message: string, metadata?: LogMetadata) =>
      write("info", message, metadata),
    warn: (message: string, metadata?: LogMetadata) =>
      write("warn", message, metadata),
    error: (message: string, metadata?: LogMetadata) =>
      write("error", message, metadata),
  }
}

export const logger = createLogger()
