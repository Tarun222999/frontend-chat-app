"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import type {
  AiChatMessage,
  AiMessageRole,
  AiMessageStatus,
  AiModelProfile,
} from "@/features/ai-chat/domain"
import { AiChatApiError } from "./ai-chat-api"
import {
  useAiConversationDetailQuery,
  useRetryAiMessageMutation,
  useStreamAiMessageMutation,
} from "./hooks"
import { aiChatQueryKeys } from "./query-keys"

const MESSAGE_PAGE_SIZE = 100

const profileLabels: Record<AiModelProfile, string> = {
  free: "Free",
  fast: "Fast",
  balanced: "Balanced",
}

const profileDescriptions: Record<AiModelProfile, string> = {
  free: "Best zero-cost default",
  fast: "Low-latency responses",
  balanced: "Better quality when available",
}

const modelProfiles: AiModelProfile[] = ["free", "fast", "balanced"]

const starterPrompts = [
  {
    title: "Break down a product idea",
    prompt:
      "Help me turn this product idea into scope, risks, user value, and a practical build order.",
  },
  {
    title: "Review this UI decision",
    prompt:
      "Review this UI decision like a product designer. Call out what works, what feels heavy, and what to simplify.",
  },
  {
    title: "Debug backend architecture",
    prompt:
      "Help me debug this backend architecture. Start by mapping the flow, then identify likely failure points.",
  },
]

const roleLabels: Record<AiMessageRole, string> = {
  user: "You",
  assistant: "AI",
  system: "System",
}

const statusLabels: Record<AiMessageStatus, string> = {
  pending: "Pending",
  streaming: "Generating",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Stopped",
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const formatMessageTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Recent"
  }

  return timeFormatter.format(date)
}

const getConversationErrorMessage = (error: unknown) => {
  if (error instanceof AiChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue AI Chat."
    }

    if (error.status === 404) {
      return "This AI conversation was not found."
    }

    return error.message || "We couldn't load this AI conversation."
  }

  return "We couldn't load this AI conversation."
}

const getSendErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return null
  }

  if (error instanceof AiChatApiError) {
    if (error.status === 401) {
      return "Your session expired. Sign in again to continue AI Chat."
    }

    return error.message || "We couldn't send that AI message."
  }

  return "We couldn't send that AI message."
}

const getMessageTone = (message: AiChatMessage) => {
  if (message.role === "user") {
    return "ml-auto border-amber-500/20 bg-amber-900/35 text-amber-50"
  }

  if (message.role === "system") {
    return "mx-auto max-w-2xl border-zinc-800 bg-zinc-950/75 text-zinc-300"
  }

  if (message.status === "failed") {
    return "mr-auto border-red-900/70 bg-red-950/30 text-red-50"
  }

  if (message.status === "cancelled") {
    return "mr-auto border-zinc-700 bg-zinc-900/60 text-zinc-200"
  }

  return "mr-auto border-zinc-800/65 bg-zinc-950/55 text-zinc-100"
}

const isMarkdownTableDivider = (line: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)

const isMarkdownTableRow = (line: string) => line.includes("|")

const splitTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())

const isBlockStart = (line: string, nextLine?: string) =>
  /^#{1,4}\s+/.test(line) ||
  /^```/.test(line) ||
  /^\s*[-*]\s+/.test(line) ||
  /^\s*\d+[.)]\s+/.test(line) ||
  (nextLine !== undefined &&
    isMarkdownTableRow(line) &&
    isMarkdownTableDivider(nextLine))

function InlineMarkdown({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const value = match[0]

    if (value.startsWith("`")) {
      parts.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-black/35 px-1 py-0.5 text-[0.92em] text-amber-100"
        >
          {value.slice(1, -1)}
        </code>,
      )
    } else {
      parts.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-white">
          {value.slice(2, -2)}
        </strong>,
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
}

function AiMarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ""

    if (line.trim().length === 0) {
      index += 1
      continue
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line)

    if (headingMatch) {
      const level = headingMatch[1].length
      const heading = headingMatch[2].trim()
      const className =
        level <= 2
          ? "mt-4 text-base font-semibold text-white first:mt-0"
          : "mt-3 text-sm font-semibold text-zinc-100 first:mt-0"

      blocks.push(
        level <= 2 ? (
          <h3 key={index} className={className}>
            <InlineMarkdown text={heading} />
          </h3>
        ) : (
          <h4 key={index} className={className}>
            <InlineMarkdown text={heading} />
          </h4>
        ),
      )
      index += 1
      continue
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      blocks.push(
        <pre
          key={index}
          className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 bg-black/35 p-3 text-xs leading-5 text-zinc-200 first:mt-0"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      )
      continue
    }

    const nextLine = lines[index + 1]

    if (
      nextLine !== undefined &&
      isMarkdownTableRow(line) &&
      isMarkdownTableDivider(nextLine)
    ) {
      const headers = splitTableCells(line)
      const rows: string[][] = []
      index += 2

      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        rows.push(splitTableCells(lines[index]))
        index += 1
      }

      blocks.push(
        <div key={index} className="mt-3 overflow-x-auto first:mt-0">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-700/80">
                {headers.map((header, cellIndex) => (
                  <th
                    key={`${header}-${cellIndex}`}
                    scope="col"
                    className="bg-zinc-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400"
                  >
                    <InlineMarkdown text={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-zinc-800/70 last:border-b-0"
                >
                  {headers.map((_header, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="align-top px-3 py-2 text-zinc-300"
                    >
                      <InlineMarkdown text={row[cellIndex] ?? ""} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const unorderedListMatch = /^\s*[-*]\s+/.test(line)
    const orderedListMatch = /^\s*\d+[.)]\s+/.test(line)

    if (unorderedListMatch || orderedListMatch) {
      const items: string[] = []
      const itemPattern = unorderedListMatch ? /^\s*[-*]\s+/ : /^\s*\d+[.)]\s+/

      while (index < lines.length && itemPattern.test(lines[index])) {
        items.push(lines[index].replace(itemPattern, "").trim())
        index += 1
      }

      const ListTag = unorderedListMatch ? "ul" : "ol"

      blocks.push(
        <ListTag
          key={index}
          className={`mt-2 space-y-1 pl-5 text-sm leading-6 text-zinc-300 first:mt-0 ${
            unorderedListMatch ? "list-disc" : "list-decimal"
          }`}
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ListTag>,
      )
      continue
    }

    const paragraphLines = [line.trim()]
    index += 1

    while (
      index < lines.length &&
      lines[index].trim().length > 0 &&
      !isBlockStart(lines[index], lines[index + 1])
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }

    blocks.push(
      <p key={index} className="mt-2 text-sm leading-6 text-zinc-300 first:mt-0">
        <InlineMarkdown text={paragraphLines.join(" ")} />
      </p>,
    )
  }

  return <div className="space-y-2">{blocks}</div>
}

function MessageBubble({
  canRetry,
  copied,
  message,
  onCopy,
  onRetry,
}: {
  canRetry: boolean
  copied: boolean
  message: AiChatMessage
  onCopy: (message: AiChatMessage) => void
  onRetry: (message: AiChatMessage) => void
}) {
  const isAssistant = message.role === "assistant"
  const profileLabel =
    isAssistant && message.model ? profileLabels[message.model.profile] : null
  const shouldShowStatus = message.status !== "complete"
  const canCopy = isAssistant && message.content.length > 0

  return (
    <article
      className={`max-w-[min(48rem,94%)] rounded-2xl border px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] ${getMessageTone(message)}`}
    >
      <div className="flex items-center justify-between gap-4">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
            message.role === "user" ? "text-amber-200/60" : "text-zinc-500"
          }`}
        >
          {roleLabels[message.role]}
        </p>
        <p
          className={`shrink-0 text-[11px] uppercase tracking-[0.18em] ${
            message.role === "user" ? "text-amber-200/45" : "text-zinc-600"
          }`}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>

      <div className="mt-2 break-words text-sm leading-6">
        {message.content && isAssistant ? (
          <AiMarkdownContent content={message.content} />
        ) : message.content ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <span className="text-zinc-500">{statusLabels[message.status]}</span>
        )}
      </div>

      {profileLabel || shouldShowStatus || message.errorMessage ? (
        <footer
          className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] ${
            message.role === "user" ? "text-amber-200/45" : "text-zinc-600"
          }`}
        >
          {profileLabel ? <span>{profileLabel}</span> : null}
          {shouldShowStatus ? <span>{statusLabels[message.status]}</span> : null}
          {message.errorMessage ? (
            <span className="normal-case tracking-normal text-red-200">
              {message.errorMessage}
            </span>
          ) : null}
        </footer>
      ) : null}

      {canCopy || canRetry ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 opacity-80 transition-opacity hover:opacity-100">
          {canCopy ? (
            <button
              type="button"
              onClick={() => onCopy(message)}
              className="rounded-full border border-zinc-700/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:border-amber-600/60 hover:text-amber-200"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
          {canRetry ? (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="rounded-full border border-zinc-700/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:border-amber-600/60 hover:text-amber-200"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function MessageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="h-20 max-w-[42rem] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/45" />
      <div className="ml-auto h-16 max-w-[30rem] animate-pulse rounded-2xl border border-amber-700/15 bg-amber-900/10" />
      <div className="h-24 max-w-[46rem] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/45" />
    </div>
  )
}

function ModelProfileMenu({
  disabled,
  selectedProfile,
  onSelectProfile,
}: {
  disabled: boolean
  selectedProfile: AiModelProfile
  onSelectProfile: (profile: AiModelProfile) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="h-10 rounded-full border border-zinc-800 bg-black/30 px-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-amber-600/55 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {profileLabels[selectedProfile]} <span aria-hidden="true">v</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute bottom-12 left-0 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
        >
          {modelProfiles.map((profile) => {
            const isSelected = selectedProfile === profile

            return (
              <button
                key={profile}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onSelectProfile(profile)
                  setIsOpen(false)
                }}
                className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-amber-600/15 text-amber-100"
                    : "text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {profileLabels[profile]}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {profileDescriptions[profile]}
                  </span>
                </span>
                {isSelected ? (
                  <span className="text-xs text-amber-400">On</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function EmptyConversationStarterPrompts({
  disabled,
  onStart,
}: {
  disabled: boolean
  onStart: (prompt: string) => void
}) {
  return (
    <div className="mx-auto mt-8 max-w-4xl">
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-amber-700/25 bg-black/20 px-4 py-6 text-center">
        <p className="text-sm font-medium text-white">New AI chat</p>
        <p className="mt-1.5 text-sm leading-6 text-zinc-500">
          Start with a prompt or type your own message below.
        </p>
      </div>

      <div className="mt-3 grid gap-1.5 md:grid-cols-3 md:gap-2">
        {starterPrompts.map((starter) => (
          <button
            key={starter.title}
            type="button"
            disabled={disabled}
            onClick={() => onStart(starter.prompt)}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 text-left transition-[background-color,border-color] hover:border-amber-600/45 hover:bg-amber-500/[0.035] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-28 md:p-3.5"
          >
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500/80 md:block">
              Prompt
            </span>
            <h3 className="text-sm font-semibold text-white md:mt-2">
              {starter.title}
            </h3>
            <p className="mt-1 hidden line-clamp-2 text-sm leading-5 text-zinc-500 md:block">
              {starter.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function AiConversation({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient()
  const conversationQuery = useAiConversationDetailQuery(conversationId, {
    limit: MESSAGE_PAGE_SIZE,
  })
  const streamMessageMutation = useStreamAiMessageMutation()
  const retryMessageMutation = useRetryAiMessageMutation()
  const conversation = conversationQuery.data
  const messageViewportRef = useRef<HTMLDivElement | null>(null)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const [draft, setDraft] = useState("")
  const [localMessages, setLocalMessages] = useState<AiChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<AiModelProfile>("free")
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const displayedMessages = useMemo(
    () => [...(conversation?.messages ?? []), ...localMessages],
    [conversation?.messages, localMessages],
  )

  useEffect(() => {
    if (!conversation) {
      return
    }

    setSelectedProfile((currentProfile) =>
      currentProfile === "free" ? conversation.model.profile : currentProfile,
    )
  }, [conversation])

  useEffect(() => {
    const viewport = messageViewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  }, [displayedMessages])

  const replaceLocalMessage = (
    messageId: string,
    updater: (message: AiChatMessage) => AiChatMessage,
  ) => {
    setLocalMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    )
  }

  const refreshPersistedConversation = async () => {
    await Promise.allSettled([
      conversationQuery.refetch(),
      queryClient.invalidateQueries({
        queryKey: aiChatQueryKeys.conversations(),
      }),
    ])
  }

  const handleStopStreaming = () => {
    activeAbortControllerRef.current?.abort()
  }

  const copyMessage = async (message: AiChatMessage) => {
    if (!message.content) {
      return
    }

    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      window.setTimeout(() => setCopiedMessageId(null), 1600)
    } catch {
      setSendError("We couldn't copy that message.")
    }
  }

  const appendStreamingAssistantMessage = (
    profile: AiModelProfile,
    now: string,
    messageId: string,
  ) => {
    setLocalMessages((currentMessages) => [
      ...currentMessages,
      {
        id: messageId,
        conversationId,
        role: "assistant",
        content: "",
        status: "streaming",
        model: {
          profile,
          provider: "pending",
          modelId: "pending",
        },
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      },
    ])
  }

  const readAssistantStream = async (
    stream: ReadableStream<string>,
    assistantMessageId: string,
  ) => {
    const reader = stream.getReader()
    let assistantText = ""

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      assistantText += value
      replaceLocalMessage(assistantMessageId, (message) => ({
        ...message,
        content: assistantText,
        updatedAt: new Date().toISOString(),
      }))
    }

    replaceLocalMessage(assistantMessageId, (message) => ({
      ...message,
      content: assistantText,
      status: "complete",
      updatedAt: new Date().toISOString(),
    }))
  }

  const markLocalAssistantDone = (
    assistantMessageId: string,
    abortController: AbortController,
    error: unknown,
  ) => {
    const nextError = getSendErrorMessage(error)
    const wasAborted = abortController.signal.aborted

    replaceLocalMessage(assistantMessageId, (message) => ({
      ...message,
      status: wasAborted ? "cancelled" : "failed",
      errorMessage: wasAborted ? null : nextError,
      updatedAt: new Date().toISOString(),
    }))

    if (nextError) {
      setSendError(nextError)
    }
  }

  const streamUserText = async (text: string) => {
    if (!conversation || isStreaming) {
      return
    }

    const trimmedText = text.trim()

    if (!trimmedText) {
      return
    }

    const now = new Date().toISOString()
    const clientMessageId = crypto.randomUUID()
    const userMessageId = `local-user-${clientMessageId}`
    const assistantMessageId = `local-assistant-${clientMessageId}`
    const abortController = new AbortController()

    setDraft("")
    setSendError(null)
    setIsStreaming(true)
    activeAbortControllerRef.current = abortController
    setLocalMessages([
      {
        id: userMessageId,
        conversationId,
        role: "user",
        content: trimmedText,
        status: "complete",
        model: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        clientMessageId,
      },
    ])
    appendStreamingAssistantMessage(selectedProfile, now, assistantMessageId)

    try {
      const streamResult = await streamMessageMutation.mutateAsync({
        conversationId,
        text: trimmedText,
        modelProfile: selectedProfile,
        clientMessageId,
        signal: abortController.signal,
      })
      await readAssistantStream(streamResult.text, assistantMessageId)
      await refreshPersistedConversation()
      setLocalMessages([])
    } catch (error) {
      markLocalAssistantDone(assistantMessageId, abortController, error)
      await refreshPersistedConversation()
      setLocalMessages([])
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null
      }

      setIsStreaming(false)
    }
  }

  const handleSendMessage = async () => {
    await streamUserText(draft)
  }

  const handleRetryMessage = async (message: AiChatMessage) => {
    if (!conversation || isStreaming) {
      return
    }

    const now = new Date().toISOString()
    const retryClientId = crypto.randomUUID()
    const assistantMessageId = `local-retry-assistant-${retryClientId}`
    const abortController = new AbortController()

    setSendError(null)
    setIsStreaming(true)
    activeAbortControllerRef.current = abortController
    appendStreamingAssistantMessage(selectedProfile, now, assistantMessageId)

    try {
      const streamResult = await retryMessageMutation.mutateAsync({
        conversationId,
        assistantMessageId: message.id,
        modelProfile: selectedProfile,
        signal: abortController.signal,
      })

      await readAssistantStream(streamResult.text, assistantMessageId)
      await refreshPersistedConversation()
      setLocalMessages([])
    } catch (error) {
      markLocalAssistantDone(assistantMessageId, abortController, error)
      await refreshPersistedConversation()
      setLocalMessages([])
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null
      }

      setIsStreaming(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/60 sm:rounded-2xl">
      <header className="shrink-0 border-b border-amber-700/10 bg-black/35 px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/ai"
              prefetch={false}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500/80 transition-colors hover:text-amber-200"
            >
              AI Chat
            </Link>
            <h1 className="mt-1 truncate text-base font-semibold text-white">
              {conversation?.title ?? "AI Conversation"}
            </h1>
          </div>
          {conversation ? (
            <div className="shrink-0 pt-1 text-xs text-zinc-500">
              {profileLabels[conversation.model.profile]} model
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_0%,rgba(180,83,9,0.055),transparent_34%),linear-gradient(180deg,rgba(180,83,9,0.025),transparent_44%)]">
        <div
          ref={messageViewportRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5"
          aria-busy={conversationQuery.isPending}
        >
          {conversationQuery.isPending ? (
            <MessageSkeleton />
          ) : conversationQuery.isError ? (
            <div
              role="alert"
              className="mx-auto mt-8 max-w-lg rounded-2xl border border-red-900/70 bg-red-950/30 px-4 py-4 text-sm text-red-100"
            >
              <p>{getConversationErrorMessage(conversationQuery.error)}</p>
              <button
                type="button"
                onClick={() => void conversationQuery.refetch()}
                className="mt-3 rounded-full border border-red-700/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-red-100 transition-colors hover:border-red-300"
              >
                Retry
              </button>
            </div>
          ) : conversation && displayedMessages.length === 0 ? (
            <EmptyConversationStarterPrompts
              disabled={isStreaming}
              onStart={(prompt) => void streamUserText(prompt)}
            />
          ) : conversation ? (
            <div className="mx-auto max-w-4xl space-y-3">
              {conversation.hasMoreHistory ? (
                <div className="mx-auto w-fit rounded-full border border-zinc-800 bg-black/30 px-3 py-1.5 text-xs font-medium text-zinc-500">
                  Older messages are available
                </div>
              ) : null}
              {displayedMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  canRetry={
                    !isStreaming &&
                    message.role === "assistant" &&
                    (message.status === "failed" ||
                      message.status === "cancelled") &&
                    !message.id.startsWith("local-")
                  }
                  copied={copiedMessageId === message.id}
                  message={message}
                  onCopy={(nextMessage) => void copyMessage(nextMessage)}
                  onRetry={(nextMessage) => void handleRetryMessage(nextMessage)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-zinc-800/80 bg-black/45 px-4 py-2.5 sm:px-5">
          {sendError ? (
            <div
              role="alert"
              className="mx-auto mb-2 max-w-4xl rounded-xl border border-red-900/70 bg-red-950/35 px-3 py-2 text-sm text-red-100"
            >
              {sendError}
            </div>
          ) : null}

          <form
            className="mx-auto grid max-w-4xl grid-cols-[1fr_auto] gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/75 p-2 sm:flex sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSendMessage()
            }}
          >
            <textarea
              rows={1}
              value={draft}
              disabled={!conversation || isStreaming || conversationQuery.isError}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleSendMessage()
                }
              }}
              placeholder="Message AI"
              className="col-span-2 max-h-36 min-h-10 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed sm:col-span-1 sm:flex-1"
            />
            <ModelProfileMenu
              disabled={!conversation || isStreaming || conversationQuery.isError}
              selectedProfile={selectedProfile}
              onSelectProfile={setSelectedProfile}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStreaming}
                className="h-10 shrink-0 rounded-full border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-amber-600/60 hover:text-white"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  !conversation ||
                  conversationQuery.isError ||
                  draft.trim().length === 0
                }
                className="h-10 min-w-24 shrink-0 rounded-full bg-amber-600/85 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-500/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Send
              </button>
            )}
          </form>
        </footer>
      </div>
    </section>
  )
}
