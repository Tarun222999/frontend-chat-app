import type { ChatMessage } from "./models"

export const compareMessagesByDateAndId = <
  T extends { id: string; createdAt?: string; sentAt?: string },
>(
  left: T,
  right: T,
) => {
  const leftDate = left.sentAt ?? left.createdAt ?? ""
  const rightDate = right.sentAt ?? right.createdAt ?? ""
  const dateComparison = leftDate.localeCompare(rightDate)

  if (dateComparison !== 0) {
    return dateComparison
  }

  return left.id.localeCompare(right.id)
}

export const compareConversationMessages = (
  left: ChatMessage,
  right: ChatMessage,
) => compareMessagesByDateAndId(left, right)

export const sortConversationMessages = (messages: ChatMessage[]) =>
  [...messages].sort(compareConversationMessages)
