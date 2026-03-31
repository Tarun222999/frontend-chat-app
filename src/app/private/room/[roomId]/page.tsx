"use client"

import { format } from "date-fns"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useUsername } from "@/hooks/use-username"
import { client } from "@/lib/client"
import { encrypt } from "@/lib/encryption"
import { useRealtime } from "@/lib/realtime-client"
import DecryptedMessage from "@/components/private-chat-decrypted-message"

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function PrivateRoomPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { username } = useUsername()
  const roomId = params.roomId as string
  const [copyStatus, setCopyStatus] = useState("COPY")
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ["room-expiration", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: { roomId },
      })

      return res.data
    },
    staleTime: Infinity,
  })

  const setTimeEvent = useEffectEvent((time: number) => {
    setTimeRemaining(time)
  })

  useEffect(() => {
    if (!data) {
      return
    }

    if (data.destroyed || !data.expiresAt) {
      router.push("/private?destroyed=true")
      return
    }

    const drift = Date.now() - data.serverTime

    const calculateRemaining = () => {
      const correctedNow = Date.now() - drift

      return Math.max(0, Math.floor((data.expiresAt - correctedNow) / 1000))
    }

    setTimeEvent(calculateRemaining())

    const interval = setInterval(() => {
      const remaining = calculateRemaining()
      setTimeEvent(remaining)

      if (remaining === 0) {
        router.push("/private?destroyed=true")
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [data, router])

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "")

      if (hash) {
        if (hash.length !== 64) {
          router.push("/private?error=invalid-key")
        } else {
          setEncryptionKey(hash)
        }

        return
      }

      router.push("/private?error=missing-key")
    }

    handleHashChange()
    globalThis.addEventListener("hashchange", handleHashChange)

    return () => globalThis.removeEventListener("hashchange", handleHashChange)
  }, [router])

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } })
      return res.data
    },
  })

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!encryptionKey) {
        console.error("Refused to send message without encryption key", {
          roomId,
          username,
        })
        throw new Error("Missing encryption key")
      }

      const encrypted = await encrypt(text, encryptionKey)

      const res = await client.messages.post(
        { sender: username, text: encrypted },
        { query: { roomId } },
      )

      if (res.status !== 200) {
        console.error("Failed to send encrypted message", {
          status: res.status,
          error: res.error,
          roomId,
        })
        throw new Error("Unable to send message right now.")
      }

      setInput("")
    },
    onMutate: () => {
      setActionError(null)
    },
    onError: (error) => {
      console.error("sendMessage mutation failed", error)
      setActionError(
        error instanceof Error && error.message === "Missing encryption key"
          ? "Encryption key missing. Reopen the secure invite link and try again."
          : "Unable to send your encrypted message right now.",
      )
    },
  })

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetch()
      }

      if (event === "chat.destroy") {
        router.push("/private?destroyed=true")
      }
    },
  })

  const copyLink = () => {
    navigator.clipboard.writeText(globalThis.location.href)
    setCopyStatus("COPIED")
    setTimeout(() => setCopyStatus("COPY"), 2000)
  }

  const { mutate: destroyRoom, isPending: isDestroyPending } = useMutation({
    mutationFn: async () => {
      const res = await client.room.delete(null, { query: { roomId } })

      if (res.status !== 200) {
        console.error("Failed to destroy room", {
          status: res.status,
          error: res.error,
          roomId,
        })
        throw new Error("Unable to destroy the room right now.")
      }
    },
    onMutate: () => {
      setActionError(null)
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["messages", roomId] })
      queryClient.removeQueries({ queryKey: ["room-expiration", roomId] })
      router.push("/private?destroyed=true")
    },
    onError: (error) => {
      console.error("destroyRoom mutation failed", error)
      setActionError("Unable to destroy the room right now.")
    },
  })

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-zinc-500">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="truncate font-bold text-green-500">{roomId}</span>
              <button
                onClick={copyLink}
                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span className="text-xs uppercase text-zinc-500">
              Self-Destruct
            </span>
            <span
              className={`flex items-center gap-2 text-sm font-bold ${
                timeRemaining !== null && timeRemaining < 60
                  ? "text-red-500"
                  : "text-amber-500"
              }`}
            >
              {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
            </span>
          </div>
        </div>

        <button
          className="group flex items-center gap-2 rounded bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-400 transition-all hover:bg-red-600 hover:text-white disabled:opacity-50"
          onClick={() => destroyRoom()}
          disabled={isDestroyPending}
        >
          <span className="group-hover:animate-pulse">!!</span>
          DESTROY NOW
        </button>
      </header>

      {actionError && (
        <div className="border-b border-red-900 bg-red-950/50 px-4 py-3">
          <p role="alert" className="text-sm text-red-400">
            {actionError}
          </p>
        </div>
      )}

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {messages?.messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-sm text-zinc-600">
              No messages yet, start the conversation.
            </p>
          </div>
        )}

        {messages?.messages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start">
            <div className="group max-w-[80%]">
              <div className="mb-1 flex items-baseline gap-3">
                <span
                  className={`text-xs font-bold ${
                    msg.sender === username ? "text-green-500" : "text-blue-500"
                  }`}
                >
                  {msg.sender === username ? "YOU" : msg.sender}
                </span>

                <span className="text-[10px] text-zinc-600">
                  {format(msg.timeStamp, "HH:mm")}
                </span>
              </div>

              <div className="break-all text-sm leading-relaxed text-zinc-300">
                <DecryptedMessage text={msg.text} encryptionKey={encryptionKey} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex gap-4">
          <div className="group relative flex-1">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 animate-pulse text-green-500">
              {">"}
            </span>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder={
                encryptionKey ? "Type message..." : "Checking encryption..."
              }
              disabled={!encryptionKey}
              value={input}
              onKeyDown={(event) => {
                if (event.key === "Enter" && input.trim() && !isPending) {
                  sendMessage({ text: input })
                  inputRef.current?.focus()
                }
              }}
              onChange={(event) => setInput(event.target.value)}
              className="w-full border border-zinc-800 bg-black py-3 pr-4 pl-8 text-sm text-zinc-100 placeholder:text-zinc-700 transition-colors focus:border-zinc-700 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              if (!input.trim() || isPending) {
                return
              }

              sendMessage({ text: input })
              inputRef.current?.focus()
            }}
            disabled={!input.trim() || isPending || !encryptionKey}
            className="cursor-pointer bg-zinc-800 px-6 text-sm font-bold text-zinc-400 transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  )
}
