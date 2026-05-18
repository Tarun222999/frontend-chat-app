import { describe, expect, it } from "vitest"
import { createFallbackAiConversationTitle } from "@/features/ai-chat/domain"

describe("AI chat title generation", () => {
  it("creates a concise fallback title from the first user message", () => {
    expect(
      createFallbackAiConversationTitle(
        "Can you compare tRPC and gRPC for our backend architecture?",
      ),
    ).toBe("Compare tRPC gRPC Backend Architecture")
  })

  it("keeps product-oriented terms when naming a UI review prompt", () => {
    expect(
      createFallbackAiConversationTitle(
        "Review this UI decision like a product designer. Call out what works.",
      ),
    ).toBe("Review UI Decision Like Product Designer")
  })

  it("falls back to a generic title when the message has no useful words", () => {
    expect(createFallbackAiConversationTitle("https://example.com !!!")).toBe(
      "AI Chat",
    )
  })
})
