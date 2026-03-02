import { decrypt } from "@/lib/encryption"
import { useQuery } from "@tanstack/react-query"


const DecryptedMessage = ({
    text,
    encryptionKey
}: {
    text: string,
    encryptionKey: string | null
}) => {

    const { data: decrypted } = useQuery({
        queryKey: ["decrypted", text, encryptionKey],
        queryFn: async () => {
            if (!encryptionKey) return null
            return await decrypt(text, encryptionKey)
        },
        staleTime: Infinity,
        retry: false
    })


    // Case 1: No key provided - should theoretically not happen if we redirect, 
    // but good for safety or during transition
    if (!encryptionKey) {
        return (
            <span className="text-zinc-500 italic flex items-center gap-1">
                Encrypted Content
            </span>
        )
    }


    // Case 2: Key provided but decryption failed
    if (decrypted === null && encryptionKey) {
        return (
            <div className="text-red-500/80 flex items-start gap-2 bg-red-500/10 p-2 rounded text-xs">
                <div className="flex flex-col">
                    <span className="font-bold">Decryption Failed</span>
                    <span className="opacity-80">The key provided cannot decrypt this message.</span>
                </div>
            </div>
        )
    }



    // Case 3: Success
    return <span className="wrap-break-word whitespace-pre-wrap">{decrypted || <span className="animate-pulse">...</span>}</span>
}

export default DecryptedMessage