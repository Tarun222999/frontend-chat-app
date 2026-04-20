/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalChatUnauthorizedError } from "./personal-chat-service"

const {
  mockCreateGatewayFetch,
  mockFetchGatewayUser,
  mockWithGatewaySession,
} = vi.hoisted(() => ({
  mockCreateGatewayFetch: vi.fn(),
  mockFetchGatewayUser: vi.fn(),
  mockWithGatewaySession: vi.fn(),
}))

vi.mock("./gateway-http", async () => {
  const actual =
    await vi.importActual<typeof import("./gateway-http")>("./gateway-http")

  return {
    ...actual,
    createGatewayFetch: mockCreateGatewayFetch,
    fetchGatewayUser: mockFetchGatewayUser,
  }
})

vi.mock("./gateway-session", () => ({
  withGatewaySession: mockWithGatewaySession,
}))

import { createGatewayPersonalChatService } from "./gateway-personal-chat-service"

describe("createGatewayPersonalChatService.getSession", () => {
  beforeEach(() => {
    mockCreateGatewayFetch.mockReset()
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

describe("createGatewayPersonalChatService.searchUsers", () => {
  beforeEach(() => {
    mockCreateGatewayFetch.mockReset()
    mockFetchGatewayUser.mockReset()
    mockWithGatewaySession.mockReset()
  })

  it("returns an empty list for blank queries without fetching users", async () => {
    mockWithGatewaySession.mockImplementationOnce(async (_context, action) =>
      action({
        accessToken: "access-token",
        user: {
          id: "user-1",
        },
      }),
    )

    const service = createGatewayPersonalChatService()
    const users = await service.searchUsers(
      {
        sessionToken: "gateway-session-1",
      },
      {
        query: "   ",
        limit: 5,
      },
    )

    expect(users).toEqual([])
    expect(mockCreateGatewayFetch).not.toHaveBeenCalled()
  })

  it("normalizes non-empty queries while preserving filtering and limits", async () => {
    mockWithGatewaySession.mockImplementationOnce(async (_context, action) =>
      action({
        accessToken: "access-token",
        user: {
          id: "user-1",
        },
      }),
    )
    mockCreateGatewayFetch.mockResolvedValueOnce({
      data: [
        {
          id: "user-1",
          email: "echo@example.com",
          displayName: "Echo Vale",
        },
        {
          id: "user-2",
          email: "mara@example.com",
          displayName: "Mara Vale",
        },
        {
          id: "user-3",
          email: "ava@example.com",
          displayName: "Ava North",
        },
      ],
    })

    const service = createGatewayPersonalChatService()
    const users = await service.searchUsers(
      {
        sessionToken: "gateway-session-1",
      },
      {
        query: "  VA  ",
        limit: 1,
      },
    )

    expect(mockCreateGatewayFetch).toHaveBeenCalledWith({
      path: "/users",
      accessToken: "access-token",
    })
    expect(users).toEqual([
      {
        id: "user-2",
        handle: "mara",
        displayName: "Mara Vale",
        avatarUrl: null,
        isAvailable: true,
      },
    ])
  })
})
