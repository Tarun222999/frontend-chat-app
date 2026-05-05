"use client"

import Link from "next/link"
import type { ChatMessage } from "@/features/personal-chat/domain"
import { formatMessageTimestamp } from "./personal-conversation-shared"

export function MessageBubble({
  message,
  isOwnMessage,
  senderLabel,
  isGroupedWithPrevious = false,
  isGroupedWithNext = false,
}: {
  message: ChatMessage
  isOwnMessage: boolean
  senderLabel: string
  isGroupedWithPrevious?: boolean
  isGroupedWithNext?: boolean
}) {
  const isSecureRoom = message.kind === "privacy-link"
  const showDeliveryState =
    message.deliveryStatus !== "sent" || message.kind === "privacy-link"
  const deliveryLabel =
    message.deliveryStatus === "sent"
      ? "Shared"
      : message.deliveryStatus === "pending"
        ? "Sending"
        : "Failed"

  if (!isSecureRoom) {
    return (
      <div
        className={`flex ${
          isGroupedWithPrevious ? "mt-2" : "mt-4 first:mt-0"
        } ${isOwnMessage ? "justify-end" : "justify-start"}`}
      >
        <div className={`max-w-[76%] sm:max-w-[58%] ${isOwnMessage ? "text-right" : ""}`}>
          {!isGroupedWithPrevious ? (
            <div
              className={`mb-1 flex items-baseline gap-3 ${
                isOwnMessage ? "justify-end" : "justify-start"
              }`}
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                  isOwnMessage ? "text-sky-300" : "text-zinc-500"
                }`}
              >
                {isOwnMessage ? "You" : senderLabel}
              </span>
              <span className="text-[10px] text-zinc-600">
                {formatMessageTimestamp(message.sentAt)}
              </span>
              {message.deliveryStatus !== "sent" ? (
                <span
                  className={`text-[10px] uppercase tracking-[0.16em] ${
                    message.deliveryStatus === "failed"
                      ? "text-red-300"
                      : "text-amber-300"
                  }`}
                >
                  {message.deliveryStatus === "pending" ? "Sending" : "Failed"}
                </span>
              ) : null}
            </div>
          ) : null}
          <p
            className={`whitespace-pre-wrap break-words text-[15px] font-medium leading-6 ${
              isOwnMessage ? "text-sky-50" : "text-zinc-100"
            }`}
          >
            {message.text}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex ${
        isGroupedWithPrevious ? "mt-1" : "mt-3 first:mt-0"
      } ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] border px-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.16)] sm:max-w-[64%] ${
          isSecureRoom ? "py-2.5" : "py-2"
        } ${
          isOwnMessage
            ? `border-sky-500/25 bg-sky-500/10 text-sky-50 ${
                isGroupedWithNext ? "rounded-2xl rounded-br-lg" : "rounded-2xl rounded-br-md"
              }`
            : `border-zinc-800/80 bg-zinc-950/80 text-zinc-100 ${
                isGroupedWithNext ? "rounded-2xl rounded-bl-lg" : "rounded-2xl rounded-bl-md"
              }`
        }`}
      >
        <div className="space-y-2.5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-green-300">
              Secure Room
            </p>
            <p className="mt-1.5 text-sm font-medium leading-6 text-zinc-100">
              {message.deliveryStatus === "pending"
                ? "Preparing a private room..."
                : "Shared a private room"}
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
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full border border-green-400/45 bg-green-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-green-200 shadow-[0_0_22px_rgba(74,222,128,0.1)] transition-all hover:-translate-y-0.5 hover:border-green-300/70 hover:bg-green-400 hover:text-slate-950"
            >
              Enter Secure Room &rarr;
            </Link>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-end gap-2 text-[10px]">
          <span className="text-zinc-500">{formatMessageTimestamp(message.sentAt)}</span>
          {showDeliveryState ? (
            <span
              className={
                message.deliveryStatus === "failed"
                  ? "text-red-300"
                  : message.deliveryStatus === "pending"
                    ? "text-amber-300"
                    : isSecureRoom
                      ? "text-green-400/80"
                      : "text-zinc-500"
              }
            >
              {deliveryLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
