"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  buildPersonalLoginRedirectPath,
  buildRoutePathWithSearch,
  personalInboxPath,
} from "@/features/personal-chat/route-guard-paths"
import { usePersonalSessionQuery } from "./hooks"

const useCurrentRoutePath = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return buildRoutePathWithSearch(pathname, searchParams.toString())
}

export function PersonalProtectedRouteGuard() {
  const router = useRouter()
  const currentRoutePath = useCurrentRoutePath()
  const sessionQuery = usePersonalSessionQuery()

  useEffect(() => {
    const session = sessionQuery.data

    if (sessionQuery.isPending || sessionQuery.isError || !session) {
      return
    }

    if (!session.isAuthenticated) {
      router.replace(buildPersonalLoginRedirectPath(currentRoutePath))
    }
  }, [
    currentRoutePath,
    router,
    sessionQuery.data,
    sessionQuery.isError,
    sessionQuery.isPending,
  ])

  return null
}

export function PersonalGuestRouteGuard({
  redirectTo = personalInboxPath,
}: {
  redirectTo?: string
}) {
  const router = useRouter()
  const sessionQuery = usePersonalSessionQuery()

  useEffect(() => {
    const session = sessionQuery.data

    if (sessionQuery.isPending || sessionQuery.isError || !session) {
      return
    }

    if (session.isAuthenticated) {
      router.replace(redirectTo)
    }
  }, [
    redirectTo,
    router,
    sessionQuery.data,
    sessionQuery.isError,
    sessionQuery.isPending,
  ])

  return null
}
