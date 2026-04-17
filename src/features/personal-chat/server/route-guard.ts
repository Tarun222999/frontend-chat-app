import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { PersonalSession } from "@/features/personal-chat/domain"
import {
  buildPersonalLoginRedirectPath,
  personalInboxPath,
} from "@/features/personal-chat/route-guard-paths"
import { getPersonalChatService } from "./get-personal-chat-service"
import { getPersonalChatSessionToken } from "./session-cookie"

export const getPersonalRouteSession = async (): Promise<PersonalSession> => {
  const cookieStore = await cookies()
  const service = getPersonalChatService()

  return service.getSession({
    sessionToken: getPersonalChatSessionToken(cookieStore),
  })
}

export const requirePersonalRouteSession = async (nextPath: string) => {
  const session = await getPersonalRouteSession()

  if (!session.isAuthenticated) {
    redirect(buildPersonalLoginRedirectPath(nextPath))
  }

  return session
}

export const redirectAuthenticatedPersonalRoute = async (
  redirectTo: string = personalInboxPath,
) => {
  const session = await getPersonalRouteSession()

  if (session.isAuthenticated) {
    redirect(redirectTo)
  }

  return session
}
