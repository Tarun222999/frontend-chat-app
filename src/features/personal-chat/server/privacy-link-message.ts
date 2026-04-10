const PRIVACY_ROOM_LINK_PATTERN =
  /^Secure room: (\/private\/room\/([A-Za-z0-9_-]+))$/

export const createPersonalChatPrivacyLinkBody = (roomId: string) =>
  `Secure room: /private/room/${roomId}`

export const parsePersonalChatPrivacyLinkBody = (body: string) => {
  const match = PRIVACY_ROOM_LINK_PATTERN.exec(body)

  const roomUrl = match?.[1]
  const roomId = match?.[2]

  if (!roomId || !roomUrl) {
    return null
  }

  return {
    roomId,
    roomUrl,
    label: "Open secure room",
  }
}
