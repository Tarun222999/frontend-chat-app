const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/
const ENCRYPTION_KEY_PATTERN = /^[A-Fa-f0-9]{64}$/
const PRIVACY_ROOM_URL_PATTERN =
  /^\/private\/room\/([A-Za-z0-9_-]+)(?:#([A-Fa-f0-9]{64}))?$/
const PRIVACY_ROOM_LINK_PATTERN =
  /^Secure room: (\/private\/room\/([A-Za-z0-9_-]+)(?:#([A-Fa-f0-9]{64}))?)$/

export const personalChatPrivacyRoomLabel = "Open secure room"

export const isValidPersonalChatPrivacyRoomKey = (value: string) =>
  ENCRYPTION_KEY_PATTERN.test(value)

export const isValidPersonalChatPrivacyRoomUrl = (value: string) =>
  PRIVACY_ROOM_URL_PATTERN.test(value)

export const buildPersonalChatPrivacyRoomUrl = (
  roomId: string,
  encryptionKey?: string,
) => {
  if (!ROOM_ID_PATTERN.test(roomId)) {
    throw new Error(`Invalid private room id "${roomId}"`)
  }

  const normalizedEncryptionKey = encryptionKey?.toLowerCase()

  if (
    normalizedEncryptionKey &&
    !isValidPersonalChatPrivacyRoomKey(normalizedEncryptionKey)
  ) {
    throw new Error("Invalid private room encryption key")
  }

  return normalizedEncryptionKey
    ? `/private/room/${roomId}#${normalizedEncryptionKey}`
    : `/private/room/${roomId}`
}

export const createPersonalChatPrivacyLinkBody = (
  roomId: string,
  encryptionKey: string,
) => `Secure room: ${buildPersonalChatPrivacyRoomUrl(roomId, encryptionKey)}`

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
    label: personalChatPrivacyRoomLabel,
  }
}
