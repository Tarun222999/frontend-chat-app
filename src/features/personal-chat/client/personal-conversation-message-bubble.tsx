"use client"

import Link from "next/link"
import type { ChatMessage } from "@/features/personal-chat/domain"
import { formatMessageTimestamp } from "./personal-conversation-shared"

export function MessageBubble({
  message,
  isOwnMessage,
}: {
  message: ChatMessage
  isOwnMessage: boolean
}) {
  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-3xl border px-4 py-3 ${
          isOwnMessage
            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-50"
            : "border-zinc-800 bg-black/25 text-zinc-100"
        }`}
      >
        {message.kind === "privacy-link" ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Secure room
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-200">
                {message.deliveryStatus === "pending"
                  ? "Generating a secure room handoff..."
                  : message.label}
              </p>
            </div>
            {message.deliveryStatus === "failed" ? (
              <p className="text-sm text-red-300">
                Secure room creation failed. Try again.
              </p>
            ) : message.deliveryStatus === "pending" ? (
              <span className="inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                Preparing
              </span>
            ) : (
              <Link
                href={message.roomUrl}
                prefetch={false}
                className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition-opacity hover:opacity-90"
              >
                Open secure room
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm leading-7">{message.text}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em]">
          <span className="text-zinc-500">{formatMessageTimestamp(message.sentAt)}</span>
          <span
            className={
              message.deliveryStatus === "failed"
                ? "text-red-300"
                : message.deliveryStatus === "pending"
                  ? "text-amber-300"
                  : "text-zinc-500"
            }
          >
            {message.deliveryStatus}
          </span>
        </div>
      </div>
    </div>
  )
}
