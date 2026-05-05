"use client"

import { startTransition, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { personalInboxPath } from "@/features/personal-chat/route-guard-paths"
import { PersonalChatApiError } from "./personal-chat-api"
import {
  usePersonalLoginMutation,
  usePersonalRegisterMutation,
} from "./hooks"

const mockPersonalCredentials = {
  email: "echo@stitch.local",
  password: "Password123!",
}

type AuthMode = "login" | "register"
type RegisterStep = "credentials" | "profile"

const getAuthErrorMessage = (error: unknown, mode: AuthMode) => {
  if (error instanceof PersonalChatApiError) {
    if (mode === "login" && error.status === 401) {
      return "Invalid email or password. Please try again."
    }

    if (mode === "register" && error.status === 409) {
      return "An account with this email already exists. Sign in instead."
    }

    return error.message ||
      (mode === "register"
        ? "Unable to create your account right now."
        : "Unable to sign in right now.")
  }

  return mode === "register"
    ? "Unable to create your account right now. Please try again."
    : "Unable to sign in right now. Please try again."
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
  const registerMutation = usePersonalRegisterMutation()
  const [mode, setMode] = useState<AuthMode>("login")
  const [registerStep, setRegisterStep] = useState<RegisterStep>("credentials")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isPending = loginMutation.isPending || registerMutation.isPending
  const isRegisterProfileStep =
    mode === "register" && registerStep === "profile"
  const showCredentialFields =
    mode === "login" || registerStep === "credentials"
  const credentialFieldsClassName = showCredentialFields ? "space-y-5" : "hidden"

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setRegisterStep("credentials")
    setSubmitError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      if (mode === "register") {
        if (registerStep === "credentials") {
          setRegisterStep("profile")
          return
        }

        await registerMutation.mutateAsync({
          email,
          password,
          displayName,
        })
      } else {
        await loginMutation.mutateAsync({
          email,
          password,
        })
      }

      startTransition(() => {
        router.replace(redirectTo)
      })
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error, mode))
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="relative grid grid-cols-2 border border-zinc-800 bg-black/25 p-1 shadow-[0_0_28px_rgba(56,189,248,0.05)]">
        <span
          aria-hidden="true"
          className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] bg-sky-400/25 ring-1 ring-sky-400/70 transition-transform ${
            mode === "register" ? "translate-x-full" : "translate-x-0"
          }`}
        />
        <button
          type="button"
          onClick={() => handleModeChange("login")}
          className={`relative z-10 px-3 py-2 text-sm transition-colors ${
            mode === "login"
              ? "font-semibold text-white"
              : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("register")}
          className={`relative z-10 px-3 py-2 text-sm transition-colors ${
            mode === "register"
              ? "font-semibold text-white"
              : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          Create Account
        </button>
      </div>

      {submitError ? (
        <div
          role="alert"
          className="border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-100"
        >
          {submitError}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isRegisterProfileStep ? (
          <div className="space-y-2">
            <label
              htmlFor="personal-register-display-name"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300"
            >
              <span aria-hidden="true">&gt; </span>
              Display Name
            </label>
            <input
              id="personal-register-display-name"
              aria-label="Display Name"
              type="text"
              autoComplete="name"
              required
              minLength={3}
              maxLength={30}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isPending}
              className="w-full border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Your display name"
            />

            <button
              type="button"
              onClick={() => {
                setRegisterStep("credentials")
                setSubmitError(null)
              }}
              className="text-xs font-medium text-zinc-500 transition-colors hover:text-sky-300"
            >
              Edit credentials
            </button>
          </div>
        ) : null}

        <div className={credentialFieldsClassName}>
          <div className="space-y-2">
            <label
              htmlFor="personal-login-email"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300"
            >
              <span aria-hidden="true">&gt; </span>
              Email
            </label>
            <input
              id="personal-login-email"
              aria-label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
              className="w-full border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="personal-login-password"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300"
            >
              <span aria-hidden="true">&gt; </span>
              Password
            </label>
            <input
              id="personal-login-password"
              aria-label="Password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
              className="w-full border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Enter your password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full border border-sky-400/70 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-200 shadow-[0_0_28px_rgba(56,189,248,0.08)] transition-colors hover:bg-sky-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:opacity-70"
        >
          {mode === "register"
            ? registerStep === "credentials"
              ? "Continue"
              : registerMutation.isPending
                ? "Creating account..."
                : "Enter Personal"
            : loginMutation.isPending
              ? "Continuing..."
              : "Enter Personal"}
          {!isPending ? <span aria-hidden="true"> &rarr;</span> : null}
        </button>
      </form>

      {showMockCredentials && mode === "login" ? (
        <div className="border border-zinc-800 bg-black/20 p-4">
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
              disabled={isPending}
              className="border border-zinc-700 px-4 py-2 text-sm text-zinc-100 transition-colors hover:border-sky-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use Mock Login
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
