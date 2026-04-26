import type { ChatMessage } from "./models"

export const compareConversationMessages = (
  left: ChatMessage,
  right: ChatMessage,
) => {
  const sentAtComparison = left.sentAt.localeCompare(right.sentAt)

  if (sentAtComparison !== 0) {
    return sentAtComparison
  }

  return left.id.localeCompare(right.id)
}

export const sortConversationMessages = (messages: ChatMessage[]) =>
  [...messages].sort(compareConversationMessages)
