import { PrivateRouteFrame } from "@/features/private-chat/client"

export default function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PrivateRouteFrame>{children}</PrivateRouteFrame>
}
