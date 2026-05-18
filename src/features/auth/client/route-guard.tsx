"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  accountHomePath,
  buildAccountLoginRedirectPath,
  buildRoutePathWithSearch,
} from "@/features/auth/route-guard-paths"
import { useAccountSessionQuery } from "./hooks"

const useCurrentRoutePath = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return buildRoutePathWithSearch(pathname, searchParams.toString())
}

export function AccountProtectedRouteGuard() {
  const router = useRouter()
  const currentRoutePath = useCurrentRoutePath()
  const sessionQuery = useAccountSessionQuery()

  useEffect(() => {
    const session = sessionQuery.data

    if (sessionQuery.isPending) {
      return
    }

    if (sessionQuery.isError || !session || !session.isAuthenticated) {
      router.replace(buildAccountLoginRedirectPath(currentRoutePath))
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

export function AccountGuestRouteGuard({
  redirectTo = accountHomePath,
}: {
  redirectTo?: string
}) {
  const router = useRouter()
  const sessionQuery = useAccountSessionQuery()

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
