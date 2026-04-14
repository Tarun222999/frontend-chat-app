const PERSONAL_CHAT_SESSION_COOKIE = "personal-chat-session"
const PERSONAL_CHAT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

type IndexedCookieReader = Record<string, { value: unknown }>
type GetterCookieReader = {
  get: (name: string) => { value: unknown } | undefined
}

type CookieReader = IndexedCookieReader | GetterCookieReader

const hasCookieGetter = (cookie: CookieReader): cookie is GetterCookieReader =>
  typeof (cookie as GetterCookieReader).get === "function"

type CookieWriter = Record<
  string,
  {
    set: (
      config:
        | Record<string, unknown>
        | ((value: Record<string, unknown>) => Record<string, unknown>),
    ) => unknown
  }
>

export const getPersonalChatSessionToken = (
  cookie: CookieReader,
): string | undefined => {
  const cookieValue =
    hasCookieGetter(cookie)
      ? cookie.get(PERSONAL_CHAT_SESSION_COOKIE)?.value
      : cookie[PERSONAL_CHAT_SESSION_COOKIE]?.value

  return typeof cookieValue === "string" ? cookieValue : undefined
}

export const setPersonalChatSessionCookie = (
  cookie: CookieWriter,
  sessionToken: string,
) => {
  cookie[PERSONAL_CHAT_SESSION_COOKIE].set({
    value: sessionToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PERSONAL_CHAT_SESSION_TTL_SECONDS,
  })
}

export const clearPersonalChatSessionCookie = (cookie: CookieWriter) => {
  cookie[PERSONAL_CHAT_SESSION_COOKIE].set({
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  })
}
