import { describe, expect, it } from "vitest"
import { resolvePersonalChatRealtimeSocketUrl } from "./realtime-socket-url"

describe("resolvePersonalChatRealtimeSocketUrl", () => {
  it("keeps configured non-loopback socket URLs unchanged", () => {
    expect(
      resolvePersonalChatRealtimeSocketUrl({
        configuredSocketUrl: "https://chat.example.com",
        requestHost: "192.168.1.20:3000",
      }),
    ).toBe("https://chat.example.com")
  })

  it("rewrites localhost socket URLs to the request host for mobile LAN access", () => {
    expect(
      resolvePersonalChatRealtimeSocketUrl({
        configuredSocketUrl: "http://localhost:4002",
        requestHost: "192.168.1.20:3000",
      }),
    ).toBe("http://192.168.1.20:4002/")
  })

  it("keeps localhost when the request also came from localhost", () => {
    expect(
      resolvePersonalChatRealtimeSocketUrl({
        configuredSocketUrl: "http://localhost:4002",
        requestHost: "localhost:3000",
      }),
    ).toBe("http://localhost:4002")
  })

  it("uses forwarded protocol when replacing the host", () => {
    expect(
      resolvePersonalChatRealtimeSocketUrl({
        configuredSocketUrl: "http://127.0.0.1:4002",
        requestHost: "chat.test:3000",
        requestProtocol: "https",
      }),
    ).toBe("https://chat.test:4002/")
  })
})
