"use client"

import { startTransition, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { personalInboxPath } from "@/features/personal-chat/route-guard-paths"
import { PersonalChatApiError } from "./personal-chat-api"
import { usePersonalLoginMutation } from "./hooks"

const mockPersonalCredentials = {
  email: "echo@stitch.local",
  password: "Password123!",
}

const getLoginErrorMessage = (error: unknown) => {
  if (error instanceof PersonalChatApiError) {
    if (error.status === 401) {
      return "Invalid email or password. Please try again."
    }

    return error.message || "Unable to sign in right now."
  }

  return "Unable to sign in right now. Please try again."
}

export function PersonalLoginForm({
  redirectTo = personalInboxPath,
  showMockCredentials = false,
}: {
  redirectTo?: string
  showMockCredentials?: boolean
}) {
  const router = useRouter()
  const loginMutation = usePersonalLoginMutation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      await loginMutation.mutateAsync({
        email,
        password,
      })

      startTransition(() => {
        router.replace(redirectTo)
      })
    } catch (error) {
      setSubmitError(getLoginErrorMessage(error))
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {submitError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-100"
        >
          {submitError}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="personal-login-email"
            className="text-sm font-medium text-zinc-200"
          >
            Email
          </label>
          <input
            id="personal-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loginMutation.isPending}
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="personal-login-password"
            className="text-sm font-medium text-zinc-200"
          >
            Password
          </label>
          <input
            id="personal-login-password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loginMutation.isPending}
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loginMutation.isPending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {showMockCredentials ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm text-zinc-400">
              <p className="font-medium text-zinc-200">Mock credentials</p>
              <p>
                <span className="text-zinc-500">Email:</span>{" "}
                {mockPersonalCredentials.email}
              </p>
              <p>
                <span className="text-zinc-500">Password:</span>{" "}
                {mockPersonalCredentials.password}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmail(mockPersonalCredentials.email)
                setPassword(mockPersonalCredentials.password)
                setSubmitError(null)
              }}
              disabled={loginMutation.isPending}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition-colors hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use Mock Login
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
