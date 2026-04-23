"use client"

import type { SessionUser } from "@/features/personal-chat/domain"

export function PersonalConversationComposer({
  currentUser,
  composerValue,
  composerDisabled,
  isSendingText,
  isSharingPrivacyRoom,
  composerInputRef,
  onComposerValueChange,
  onSendMessage,
  onSharePrivacyRoom,
}: {
  currentUser: SessionUser | null
  composerValue: string
  composerDisabled: boolean
  isSendingText: boolean
  isSharingPrivacyRoom: boolean
  composerInputRef: React.RefObject<HTMLInputElement | null>
  onComposerValueChange: (value: string) => void
  onSendMessage: () => void
  onSharePrivacyRoom: () => void
}) {
  return (
    <div className="border-t border-zinc-800 bg-black/25 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
            Composer
          </p>
          <p className="mt-2 text-sm text-zinc-500">Press Enter to send.</p>
        </div>
        <button
          type="button"
          onClick={onSharePrivacyRoom}
          disabled={composerDisabled}
          className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSharingPrivacyRoom ? "Sharing secure room..." : "Share Secure Room"}
        </button>
      </div>

      <div className="mt-4 flex gap-4">
        <div className="group relative flex-1">
          <span className="absolute top-1/2 left-4 -translate-y-1/2 text-cyan-400">
            {">"}
          </span>
          <input
            ref={composerInputRef}
            autoFocus
            type="text"
            value={composerValue}
            onChange={(event) => onComposerValueChange(event.target.value)}
            disabled={composerDisabled}
            maxLength={5000}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onSendMessage()
              }
            }}
            placeholder={
              currentUser ? "Type message..." : "Loading your personal session..."
            }
            className="w-full border border-zinc-800 bg-black py-3 pr-4 pl-8 text-sm text-zinc-100 placeholder:text-zinc-700 transition-colors focus:border-zinc-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <button
          type="button"
          onClick={onSendMessage}
          disabled={composerDisabled || composerValue.trim().length === 0}
          className="cursor-pointer bg-zinc-800 px-6 text-sm font-bold text-zinc-400 transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSendingText ? "SENDING" : "SEND"}
        </button>
      </div>
    </div>
  )
}
