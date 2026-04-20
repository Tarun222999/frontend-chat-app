import { PersonalRouteFrame } from "@/features/personal-chat/client"
import { getPersonalRouteSession } from "@/features/personal-chat/server"

export default async function PersonalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getPersonalRouteSession()

  return <PersonalRouteFrame session={session}>{children}</PersonalRouteFrame>
}
