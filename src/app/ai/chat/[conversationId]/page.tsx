import { AiConversationPlaceholder } from "@/features/ai-chat/client"
import { requireAccountRouteSession } from "@/features/auth/server"

export default async function AiChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const conversationPath = `/ai/chat/${conversationId}`

  await requireAccountRouteSession(conversationPath)

  return <AiConversationPlaceholder conversationId={conversationId} />
}
