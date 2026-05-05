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
  const hasMessage = composerValue.trim().length > 0
  const sendDisabled = composerDisabled || !hasMessage

  return (
    <div className="shrink-0 border-t border-sky-500/10 bg-black/35 px-4 py-3 shadow-[0_-20px_70px_rgba(14,165,233,0.07)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="group relative w-full flex-1">
          <span className="absolute top-1/2 left-4 -translate-y-1/2 text-sky-400">
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
              currentUser
                ? "Send a message..."
                : "Loading your personal session..."
            }
            className="w-full border border-zinc-800 bg-black/90 py-3 pr-4 pl-8 text-sm text-zinc-100 placeholder:text-zinc-700 transition-colors focus:border-sky-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="flex w-full gap-3 sm:w-auto">
          <button
            type="button"
            onClick={onSharePrivacyRoom}
            disabled={composerDisabled}
            aria-label="Share Secure Room"
            title="Share Secure Room"
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-zinc-700 px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-4"
          >
            <span className="hidden sm:inline">
              {isSharingPrivacyRoom ? "Sharing..." : "+ Secure Room"}
            </span>
            <span className="sm:hidden">{isSharingPrivacyRoom ? "..." : "+ Room"}</span>
          </button>

          <button
            type="button"
            onClick={onSendMessage}
            disabled={sendDisabled}
            className={`min-h-11 flex-1 px-5 py-3 text-sm font-bold transition-all sm:flex-none sm:px-6 ${
              sendDisabled
                ? "cursor-not-allowed border border-zinc-800 bg-zinc-900/70 text-zinc-600"
                : "cursor-pointer border border-sky-400/70 bg-sky-400 text-slate-950 shadow-[0_0_26px_rgba(56,189,248,0.18)] hover:border-sky-300 hover:bg-sky-300"
            }`}
          >
            {isSendingText ? "Sending" : "Send \u2192"}
          </button>
        </div>
      </div>
    </div>
  )
}
