export const personalInboxPath = "/personal"
export const personalLoginPath = "/login"

const legacyPersonalLoginPaths = ["/personal/login"] as const

const getPathname = (value: string) => value.split(/[?#]/, 1)[0] ?? value

const isPersonalLoginPath = (pathname: string) =>
  pathname === personalLoginPath ||
  legacyPersonalLoginPaths.some((loginPath) => loginPath === pathname)

export const normalizePersonalGuardNextPath = (
  value: string | null | undefined,
) => {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()

  if (trimmedValue.length === 0) {
    return null
  }

  if (!trimmedValue.startsWith("/") || trimmedValue.startsWith("//")) {
    return null
  }

  const pathname = getPathname(trimmedValue)

  if (isPersonalLoginPath(pathname)) {
    return null
  }

  if (pathname !== personalInboxPath && !pathname.startsWith(`${personalInboxPath}/`)) {
    return null
  }

  return trimmedValue
}

export const buildPersonalLoginRedirectPath = (
  nextPath?: string | null,
) => {
  const normalizedNextPath = normalizePersonalGuardNextPath(nextPath)

  if (!normalizedNextPath) {
    return personalLoginPath
  }

  return `${personalLoginPath}?next=${encodeURIComponent(normalizedNextPath)}`
}

export const resolvePersonalLoginSuccessPath = (
  nextPath?: string | null,
) => normalizePersonalGuardNextPath(nextPath) ?? personalInboxPath

export const buildRoutePathWithSearch = (
  pathname: string,
  search?: string | null,
) => {
  if (!search) {
    return pathname
  }

  return search.startsWith("?") ? `${pathname}${search}` : `${pathname}?${search}`
}
