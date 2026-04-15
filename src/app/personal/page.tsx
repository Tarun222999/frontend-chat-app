import { PersonalInbox } from "@/features/personal-chat/client"
import { personalInboxPath } from "@/features/personal-chat/route-guard-paths"
import { requirePersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalInboxPage() {
  await requirePersonalRouteSession(personalInboxPath)

  return <PersonalInbox />
}
