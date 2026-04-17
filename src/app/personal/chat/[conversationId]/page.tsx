import { PersonalConversation } from "@/features/personal-chat/client"
import { requirePersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const conversationPath = `/personal/chat/${conversationId}`

  await requirePersonalRouteSession(conversationPath)

  return <PersonalConversation conversationId={conversationId} />
}
