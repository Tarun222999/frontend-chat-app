import { describe, expect, it } from "vitest"
import {
  buildPersonalChatPrivacyRoomUrl,
  createPersonalChatPrivacyLinkBody,
  parsePersonalChatPrivacyLinkBody,
} from "./privacy-room-link"

describe("privacy-room-link", () => {
  it("builds a room URL with the encryption key in the fragment", () => {
    expect(
      buildPersonalChatPrivacyRoomUrl(
        "room-1",
        "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      ),
    ).toBe(
      "/private/room/room-1#abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    )
  })

  it("parses secure room messages that include a key fragment", () => {
    expect(
      parsePersonalChatPrivacyLinkBody(
        createPersonalChatPrivacyLinkBody(
          "room-1",
          "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        ),
      ),
    ).toEqual({
      roomId: "room-1",
      roomUrl:
        "/private/room/room-1#1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      label: "Open secure room",
    })
  })
})
