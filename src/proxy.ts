import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { nanoid } from 'nanoid';

type JoinRoomResult = "missing" | "existing" | "full" | "joined" | "error"

const joinRoomScript = `
local key = KEYS[1]
local existingToken = ARGV[1]
local newToken = ARGV[2]

if redis.call("EXISTS", key) == 0 then
  return "missing"
end

local connectedRaw = redis.call("HGET", key, "connected")
local connected = {}

if connectedRaw and connectedRaw ~= "" then
  local ok, decoded = pcall(cjson.decode, connectedRaw)
  if not ok or type(decoded) ~= "table" then
    return "error"
  end
  connected = decoded
end

if existingToken and existingToken ~= "" then
  for _, token in ipairs(connected) do
    if token == existingToken then
      return "existing"
    end
  end
end

if #connected >= 2 then
  return "full"
end

table.insert(connected, newToken)
redis.call("HSET", key, "connected", cjson.encode(connected))

return "joined"
`



export const proxy = async (req: NextRequest) => {
    const pathname = req.nextUrl.pathname

    const roomMatch = pathname.match(/^\/private\/room\/([^/]+)$/)
    if (!roomMatch) return NextResponse.redirect(new URL("/private", req.url))

    const roomId = roomMatch[1]
    const metaKey = `meta:${roomId}`
    const existingToken = req.cookies.get("x-auth-token")?.value
    const token = nanoid()

    const joinResult = await redis.eval<[string, string], JoinRoomResult>(
        joinRoomScript,
        [metaKey],
        [existingToken ?? "", token]
    )

    if (joinResult === "missing") {
        return NextResponse.redirect(new URL("/private?error=room-not-found", req.url))
    }

    if (joinResult === "existing") {
        return NextResponse.next()
    }

    if (joinResult === "full") {
        return NextResponse.redirect(new URL("/private?error=room-full", req.url))
    }

    if (joinResult !== "joined") {
        console.error("Unexpected proxy room join result", {
            joinResult,
            roomId,
            metaKey,
        })
        return NextResponse.redirect(new URL("/private?error=room-not-found", req.url))
    }

    const response = NextResponse.next()

    response.cookies.set("x-auth-token", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    })

    return response
}

export const config = {
    matcher: "/private/room/:path*",
}
