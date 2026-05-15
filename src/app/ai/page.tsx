import { AiInboxPlaceholder } from "@/features/ai-chat/client"
import { requireAccountRouteSession } from "@/features/auth/server"

export default async function AiInboxPage() {
  await requireAccountRouteSession("/ai")

  return <AiInboxPlaceholder />
}
