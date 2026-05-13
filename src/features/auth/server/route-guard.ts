import "server-only"

import { redirect } from "next/navigation"
import type { PersonalSession } from "@/features/personal-chat/domain"
import {
  getPersonalRouteSession,
  redirectAuthenticatedPersonalRoute,
} from "@/features/personal-chat/server"
import { buildAccountLoginRedirectPath } from "../route-guard-paths"

export type AccountSession = PersonalSession

export const getAccountRouteSession = async (): Promise<AccountSession> =>
  getPersonalRouteSession()

export const requireAccountRouteSession = async (nextPath: string) => {
  const session = await getAccountRouteSession()

  if (!session.isAuthenticated) {
    redirect(buildAccountLoginRedirectPath(nextPath))
  }

  return session
}

export const redirectAuthenticatedAccountRoute =
  redirectAuthenticatedPersonalRoute
