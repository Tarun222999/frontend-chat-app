import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AiConversationDetail } from "@/features/ai-chat/domain"
import { AiConversation } from "./ai-conversation"

const {
  mockConversationQuery,
  mockRetryMessage,
  mockStreamMessage,
} = vi.hoisted(() => ({
  mockConversationQuery: {
    data: null as AiConversationDetail | null,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  mockRetryMessage: vi.fn(),
  mockStreamMessage: vi.fn(),
}))

vi.mock("./hooks", () => ({
  useAiConversationDetailQuery: () => mockConversationQuery,
  useRetryAiMessageMutation: () => ({
    mutateAsync: mockRetryMessage,
  }),
  useStreamAiMessageMutation: () => ({
    mutateAsync: mockStreamMessage,
  }),
}))

const createTextStream = (chunks: string[]) =>
  new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }

      controller.close()
    },
  })

const renderAiConversation = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AiConversation conversationId="conversation-1" />
    </QueryClientProvider>,
  )
}

describe("AiConversation", () => {
  beforeEach(() => {
    mockStreamMessage.mockReset()
    mockRetryMessage.mockReset()
    mockConversationQuery.refetch.mockReset()
    mockConversationQuery.isPending = false
    mockConversationQuery.isError = false
    mockConversationQuery.error = null
    mockConversationQuery.data = {
      id: "conversation-1",
      title: "AI thread",
      model: {
        profile: "free",
        provider: "google",
        modelId: "gemini-2.5-flash-lite",
      },
      messages: [],
      hasMoreHistory: false,
      createdAt: "2026-05-16T08:00:00.000Z",
      updatedAt: "2026-05-16T08:00:00.000Z",
    }
    mockStreamMessage.mockResolvedValue({
      assistantMessageId: "assistant-1",
      response: new Response(),
      text: createTextStream(["Mock ", "reply"]),
    })
    mockRetryMessage.mockResolvedValue({
      assistantMessageId: "assistant-2",
      response: new Response(),
      text: createTextStream(["Retry ", "reply"]),
    })
  })

  it("sends an empty-state starter prompt through the stream endpoint", async () => {
    renderAiConversation()

    fireEvent.click(screen.getByRole("button", { name: /Plan a feature/i }))

    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-1",
          modelProfile: "free",
          text: expect.stringContaining("break down a v1 feature"),
        }),
      )
    })
  })

  it("copies assistant messages and retries stopped assistant messages", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    })
    mockConversationQuery.data = {
      ...mockConversationQuery.data!,
      messages: [
        {
          id: "assistant-failed-1",
          conversationId: "conversation-1",
          role: "assistant",
          content: "Partial answer",
          status: "cancelled",
          model: {
            profile: "fast",
            provider: "groq",
            modelId: "llama-3.1-8b-instant",
          },
          errorMessage: null,
          createdAt: "2026-05-16T08:01:00.000Z",
          updatedAt: "2026-05-16T08:01:00.000Z",
        },
      ],
    }

    renderAiConversation()

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Partial answer")
    })

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(mockRetryMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          assistantMessageId: "assistant-failed-1",
          conversationId: "conversation-1",
          modelProfile: "free",
        }),
      )
    })
  })
})
