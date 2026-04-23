"use client"

import { Suspense, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { client } from "@/lib/client"
import { generateKey } from "@/lib/encryption"
import { useUsername } from "@/hooks/use-username"

function PrivateLobby() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wasDestroyed = searchParams.get("destroyed") === "true"
  const error = searchParams.get("error")
  const { username } = useUsername()
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)

  const { mutate: createRoom, isPending } = useMutation({
    mutationFn: async () => {
      try {
        const res = await client.room.create.post()

        if (res.status !== 200 || !res.data?.roomId) {
          console.error("Failed to create room", {
            status: res.status,
            error: res.error,
          })
          throw new Error("Unable to create a secure room right now.")
        }

        router.push(`/private/room/${res.data.roomId}#${generateKey()}`)
      } catch (error) {
        console.error("createRoom mutationFn failed", error)
        throw error instanceof Error
          ? error
          : new Error("Unable to create a secure room right now.")
      }
    },
    onMutate: () => {
      setCreateRoomError(null)
    },
    onError: (error) => {
      console.error("createRoom mutation failed", error)
      setCreateRoomError(
        "Unable to create a secure room right now. Please try again.",
      )
    },
  })

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">ROOM DESTROYED</p>
            <p className="mt-1 text-xs text-zinc-500">
              All messages were permanently deleted.
            </p>
          </div>
        )}
        {error === "room-not-found" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">ROOM NOT FOUND</p>
            <p className="mt-1 text-xs text-zinc-500">
              This room may have expired or never existed.
            </p>
          </div>
        )}
        {error === "room-full" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">ROOM FULL</p>
            <p className="mt-1 text-xs text-zinc-500">
              This room is at maximum capacity.
            </p>
          </div>
        )}
        {error === "missing-key" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">CHECK URL</p>
            <p className="mt-1 text-xs text-zinc-500">
              The encryption key is missing from the link.
            </p>
          </div>
        )}
        {error === "invalid-key" && (
          <div className="border border-red-900 bg-red-950/50 p-4 text-center">
            <p className="text-sm font-bold text-red-500">
              INVALID ENCRYPTION KEY
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              The encryption key provided in the URL seems to be wrong.
            </p>
          </div>
        )}
        {createRoomError && (
          <div
            role="alert"
            className="border border-red-900 bg-red-950/50 p-4 text-center"
          >
            <p className="text-sm font-bold text-red-500">ROOM CREATION FAILED</p>
            <p className="mt-1 text-xs text-zinc-500">{createRoomError}</p>
          </div>
        )}

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            {">"}private_chat
          </h1>
          <p className="text-sm text-zinc-500">
            A private, self-destructing chat room.
          </p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="identity"
                className="flex items-center text-zinc-500"
              >
                Your Identity
              </label>

              <div className="flex items-center gap-3">
                <div className="flex-1 border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-zinc-400">
                  {username}
                </div>
              </div>
            </div>

            <button
              onClick={() => createRoom()}
              disabled={isPending}
              className="mt-2 w-full cursor-pointer bg-zinc-100 p-3 text-sm font-bold text-black transition-colors hover:bg-zinc-50 hover:text-black disabled:opacity-50"
            >
              {isPending ? "SPINNING UP A ROOM" : "CREATE SECURE ROOM"}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function PrivatePageFallback() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div
        role="status"
        aria-live="polite"
        className="text-sm text-zinc-500"
      >
        Loading private chat...
      </div>
    </main>
  )
}

export default function PrivatePage() {
  return (
    <Suspense fallback={<PrivatePageFallback />}>
      <PrivateLobby />
    </Suspense>
  )
}
