const loopbackHostnames = new Set(["localhost", "127.0.0.1", "::1"])

const getForwardedValue = (value: string | undefined) =>
  value?.split(",")[0]?.trim()

const normalizeRequestHost = (host: string | undefined) => {
  const forwardedHost = getForwardedValue(host)

  if (!forwardedHost) {
    return null
  }

  try {
    return new URL(`http://${forwardedHost}`).hostname
  } catch {
    return null
  }
}

export const resolvePersonalChatRealtimeSocketUrl = ({
  configuredSocketUrl,
  requestHost,
  requestProtocol,
}: {
  configuredSocketUrl: string
  requestHost?: string
  requestProtocol?: string
}) => {
  let socketUrl: URL

  try {
    socketUrl = new URL(configuredSocketUrl)
  } catch {
    return configuredSocketUrl
  }

  if (!loopbackHostnames.has(socketUrl.hostname)) {
    return configuredSocketUrl
  }

  const hostName = normalizeRequestHost(requestHost)

  if (!hostName || loopbackHostnames.has(hostName)) {
    return configuredSocketUrl
  }

  socketUrl.hostname = hostName

  const protocol = getForwardedValue(requestProtocol)
  if (protocol === "http" || protocol === "https") {
    socketUrl.protocol = `${protocol}:`
  }

  return socketUrl.toString()
}
