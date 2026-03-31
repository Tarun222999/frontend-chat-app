import { decrypt } from "@/lib/encryption"
import { useQuery } from "@tanstack/react-query"

export default function DecryptedMessage({
  text,
  encryptionKey,
}: {
  text: string
  encryptionKey: string | null
}) {
  const { data: decrypted } = useQuery({
    queryKey: ["decrypted", text, encryptionKey],
    queryFn: async () => {
      if (!encryptionKey) {
        return null
      }

      return decrypt(text, encryptionKey)
    },
    staleTime: Infinity,
    retry: false,
  })

  if (!encryptionKey) {
    return (
      <span className="flex items-center gap-1 italic text-zinc-500">
        Encrypted Content
      </span>
    )
  }

  if (decrypted === null) {
    return (
      <div className="flex items-start gap-2 rounded bg-red-500/10 p-2 text-xs text-red-500/80">
        <div className="flex flex-col">
          <span className="font-bold">Decryption Failed</span>
          <span className="opacity-80">
            The key provided cannot decrypt this message.
          </span>
        </div>
      </div>
    )
  }

  return (
    <span className="wrap-break-word whitespace-pre-wrap">
      {decrypted || <span className="animate-pulse">...</span>}
    </span>
  )
}
