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

    fireEvent.click(
      screen.getByRole("button", { name: /Break down a product idea/i }),
    )

    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-1",
          modelProfile: "free",
          text: expect.stringContaining("product idea"),
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

  it("formats common assistant markdown for readability", () => {
    mockConversationQuery.data = {
      ...mockConversationQuery.data!,
      messages: [
        {
          id: "assistant-markdown-1",
          conversationId: "conversation-1",
          role: "assistant",
          content: [
            "## Key Differences",
            "",
            "| Feature | tRPC | gRPC |",
            "| :-- | :-- | :-- |",
            "| Type Safety | **Built-in** | Generated from `.proto` |",
            "",
            "- Choose tRPC for TypeScript apps",
          ].join("\n"),
          status: "complete",
          model: {
            profile: "balanced",
            provider: "google",
            modelId: "gemini-2.5-flash",
          },
          errorMessage: null,
          createdAt: "2026-05-16T08:02:00.000Z",
          updatedAt: "2026-05-16T08:02:00.000Z",
        },
      ],
    }

    renderAiConversation()

    expect(
      screen.getByRole("heading", { name: "Key Differences" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Feature" })).toBeInTheDocument()
    expect(screen.getByText("Choose tRPC for TypeScript apps")).toBeInTheDocument()
  })

  it("closes the model menu when clicking outside", async () => {
    renderAiConversation()

    fireEvent.click(screen.getByRole("button", { name: "Free" }))
    expect(screen.getByRole("menu")).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })
  })
})
