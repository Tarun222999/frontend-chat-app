"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"




export const Providers = ({ children }: { children: React.ReactNode }) => {
    const [queryCLient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider
            client={queryCLient}
        >
            {children}
        </QueryClientProvider>
    )
}