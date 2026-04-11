import type {
  PersonalChatServiceContext,
} from "@/features/personal-chat/server/personal-chat-service"
import {
  PersonalChatUnauthorizedError,
} from "@/features/personal-chat/server/personal-chat-service"
import type { TransportAuthTokens } from "@/features/personal-chat/transport"
import {
  isGatewayStatus,
} from "./gateway-error-mapping"
import { createGatewayFetch } from "./gateway-http"
import {
  gatewayPersonalChatSessionStore,
  type GatewayPersonalChatSessionRecord,
} from "./gateway-session-store"

export type GatewaySession = GatewayPersonalChatSessionRecord

const refreshGatewaySession = async (sessionToken: string): Promise<GatewaySession> => {
  const session = await gatewayPersonalChatSessionStore.get(sessionToken)

  if (!session) {
    throw new PersonalChatUnauthorizedError()
  }

  const attemptedRefreshToken = session.refreshToken

  try {
    const tokens = await createGatewayFetch<TransportAuthTokens>({
      path: "/auth/refresh",
      method: "POST",
      body: {
        refreshToken: session.refreshToken,
      },
    })

    const updated = await gatewayPersonalChatSessionStore.update(sessionToken, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })

    if (!updated) {
      throw new PersonalChatUnauthorizedError()
    }

    return updated
  } catch (error) {
    if (isGatewayStatus(error, 401)) {
      const currentSession = await gatewayPersonalChatSessionStore.get(sessionToken)

      if (currentSession?.refreshToken === attemptedRefreshToken) {
        await gatewayPersonalChatSessionStore.delete(sessionToken)
      }

      throw new PersonalChatUnauthorizedError()
    }

    throw error
  }
}

export const withGatewaySession = async <T>(
  context: PersonalChatServiceContext,
  action: (session: GatewaySession) => Promise<T>,
): Promise<T> => {
  const session = await gatewayPersonalChatSessionStore.get(context.sessionToken)

  if (!session) {
    throw new PersonalChatUnauthorizedError()
  }

  try {
    return await action(session)
  } catch (error) {
    if (isGatewayStatus(error, 401) && context.sessionToken) {
      const refreshedSession = await refreshGatewaySession(context.sessionToken)
      return action(refreshedSession)
    }

    throw error
  }
}
