import { afterEach, describe, expect, it, vi } from "vitest"
import { createLogger, redactLogMetadata } from "@/lib/logger"

const createBufferedLogger = (level: "debug" | "info" | "warn" | "error" = "debug") => {
  const lines: string[] = []
  const logger = createLogger({
    level,
    service: "test-service",
    environment: "test",
    writer: (line) => {
      lines.push(line)
    },
  })

  return { logger, lines }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("logger", () => {
  it("emits structured JSON logs", () => {
    const { logger, lines } = createBufferedLogger()

    logger.info("API request completed", {
      requestId: "request-1",
      status: 200,
    })

    expect(lines).toHaveLength(1)

    const entry = JSON.parse(lines[0])
    expect(entry).toMatchObject({
      level: "info",
      service: "test-service",
      environment: "test",
      message: "API request completed",
      metadata: {
        requestId: "request-1",
        status: 200,
      },
    })
    expect(typeof entry.timestamp).toBe("string")
  })

  it("respects the configured log level", () => {
    const { logger, lines } = createBufferedLogger("warn")

    logger.debug("debug details")
    logger.info("informational details")
    logger.warn("warning details")
    logger.error("error details")

    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).level).toBe("warn")
    expect(JSON.parse(lines[1]).level).toBe("error")
  })

  it("redacts sensitive metadata fields", () => {
    const redacted = redactLogMetadata({
      token: "room-token",
      authorization: "Bearer secret",
      nested: {
        password: "password",
        encryptionKey: "secret-key",
        messageId: "safe-message-id",
      },
      items: [
        {
          cookie: "session-cookie",
          body: "raw body",
        },
      ],
    })

    expect(redacted).toEqual({
      token: "[REDACTED]",
      authorization: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        encryptionKey: "[REDACTED]",
        messageId: "safe-message-id",
      },
      items: [
        {
          cookie: "[REDACTED]",
          body: "[REDACTED]",
        },
      ],
    })
  })

  it("serializes errors without production stack traces", () => {
    vi.stubEnv("NODE_ENV", "production")
    const { logger, lines } = createBufferedLogger()
    const error = Object.assign(new Error("Gateway failed"), {
      name: "GatewayHttpError",
      status: 502,
    })

    logger.error("Gateway request failed", { error })

    const entry = JSON.parse(lines[0])
    expect(entry.metadata.error).toEqual({
      name: "GatewayHttpError",
      message: "Gateway failed",
      status: 502,
    })
  })
})
