import { describe, expect, it } from "vitest"
import {
  buildPersonalLoginRedirectPath,
  buildRoutePathWithSearch,
  normalizePersonalGuardNextPath,
  personalLoginPath,
  resolvePersonalLoginSuccessPath,
} from "@/features/personal-chat/route-guard-paths"

describe("personal route guard paths", () => {
  it("accepts protected personal paths as login return targets", () => {
    expect(normalizePersonalGuardNextPath("/personal")).toBe("/personal")
    expect(normalizePersonalGuardNextPath("/personal/chat/demo-thread")).toBe(
      "/personal/chat/demo-thread",
    )
    expect(
      normalizePersonalGuardNextPath("/personal/chat/demo-thread?draft=1"),
    ).toBe("/personal/chat/demo-thread?draft=1")
  })

  it("rejects unsafe and guest-only next paths", () => {
    expect(normalizePersonalGuardNextPath("https://example.com")).toBeNull()
    expect(normalizePersonalGuardNextPath("//example.com")).toBeNull()
    expect(normalizePersonalGuardNextPath("/personal/login")).toBeNull()
    expect(normalizePersonalGuardNextPath("/personality")).toBeNull()
    expect(normalizePersonalGuardNextPath("/")).toBeNull()
  })

  it("builds the login redirect query only for safe next paths", () => {
    expect(buildPersonalLoginRedirectPath("/personal/chat/demo-thread")).toBe(
      "/personal/login?next=%2Fpersonal%2Fchat%2Fdemo-thread",
    )
    expect(buildPersonalLoginRedirectPath("/personal/login")).toBe(
      personalLoginPath,
    )
  })

  it("resolves the post-login target to a safe personal route", () => {
    expect(resolvePersonalLoginSuccessPath("/personal/chat/demo-thread")).toBe(
      "/personal/chat/demo-thread",
    )
    expect(resolvePersonalLoginSuccessPath("/personal/login")).toBe("/personal")
    expect(resolvePersonalLoginSuccessPath("https://example.com")).toBe(
      "/personal",
    )
  })

  it("joins pathnames and search params consistently", () => {
    expect(buildRoutePathWithSearch("/personal", "next=%2Fpersonal")).toBe(
      "/personal?next=%2Fpersonal",
    )
    expect(buildRoutePathWithSearch("/personal", "?next=%2Fpersonal")).toBe(
      "/personal?next=%2Fpersonal",
    )
    expect(buildRoutePathWithSearch("/personal", "")).toBe("/personal")
  })
})
