import { treaty } from "@elysiajs/eden"
import type { App } from "@/app/api/[[...slugs]]/route"

const apiBaseUrl =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    : window.location.origin

export const client = treaty<App>(apiBaseUrl).api
