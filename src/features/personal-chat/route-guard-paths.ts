export const personalInboxPath = "/personal"
export const personalLoginPath = "/personal/login"

const getPathname = (value: string) => value.split(/[?#]/, 1)[0] ?? value

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

  if (pathname !== personalInboxPath && !pathname.startsWith(`${personalInboxPath}/`)) {
    return null
  }

  if (pathname === personalLoginPath) {
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
