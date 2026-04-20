/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalChatUnauthorizedError } from "./personal-chat-service"

const {
  mockFetchGatewayUser,
  mockWithGatewaySession,
} = vi.hoisted(() => ({
  mockFetchGatewayUser: vi.fn(),
  mockWithGatewaySession: vi.fn(),
}))

vi.mock("./gateway-http", async () => {
  const actual =
    await vi.importActual<typeof import("./gateway-http")>("./gateway-http")

  return {
    ...actual,
    fetchGatewayUser: mockFetchGatewayUser,
  }
})

vi.mock("./gateway-session", () => ({
  withGatewaySession: mockWithGatewaySession,
}))

import { createGatewayPersonalChatService } from "./gateway-personal-chat-service"

describe("createGatewayPersonalChatService.getSession", () => {
  beforeEach(() => {
    mockFetchGatewayUser.mockReset()
    mockWithGatewaySession.mockReset()
  })

  it("validates the stored session against the gateway before authenticating", async () => {
    const storedSession = {
      sessionToken: "gateway-session-1",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1",
        handle: "echo",
        displayName: "Echo Vale",
        avatarUrl: null,
      },
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    }
    const validatedUser = {
      ...storedSession.user,
      displayName: "Echo Validated",
    }

    mockWithGatewaySession.mockImplementationOnce(async (_context, action) =>
      action(storedSession),
    )
    mockFetchGatewayUser.mockResolvedValueOnce(validatedUser)

    const service = createGatewayPersonalChatService()
    const session = await service.getSession({
      sessionToken: storedSession.sessionToken,
    })

    expect(mockWithGatewaySession).toHaveBeenCalledWith(
      {
        sessionToken: storedSession.sessionToken,
      },
      expect.any(Function),
    )
    expect(mockFetchGatewayUser).toHaveBeenCalledWith(
      storedSession.accessToken,
      storedSession.user.id,
    )
    expect(session).toEqual({
      isAuthenticated: true,
      user: validatedUser,
    })
  })

  it("treats stale gateway sessions as unauthenticated", async () => {
    mockWithGatewaySession.mockRejectedValueOnce(
      new PersonalChatUnauthorizedError(),
    )

    const service = createGatewayPersonalChatService()
    const session = await service.getSession({
      sessionToken: "stale-session",
    })

    expect(mockFetchGatewayUser).not.toHaveBeenCalled()
    expect(session).toEqual({
      isAuthenticated: false,
      user: null,
    })
  })

  it("returns unauthenticated when no session token is present", async () => {
    const service = createGatewayPersonalChatService()
    const session = await service.getSession({})

    expect(mockWithGatewaySession).not.toHaveBeenCalled()
    expect(mockFetchGatewayUser).not.toHaveBeenCalled()
    expect(session).toEqual({
      isAuthenticated: false,
      user: null,
    })
  })
})
