export type {
  components as PersonalChatTransportComponents,
  operations as PersonalChatTransportOperations,
  paths as PersonalChatTransportPaths,
} from "./generated/openapi"

import type {
  components as PersonalChatTransportComponents,
  paths as PersonalChatTransportPaths,
} from "./generated/openapi"

type PersonalChatTransportSchemas = PersonalChatTransportComponents["schemas"]

export type TransportAuthResponse = PersonalChatTransportSchemas["AuthResponse"]
export type TransportAuthTokens = PersonalChatTransportSchemas["AuthTokens"]
export type TransportAuthUser = PersonalChatTransportSchemas["AuthUser"]
export type TransportConversation = PersonalChatTransportSchemas["Conversation"]
export type TransportConversationEnvelope =
  PersonalChatTransportSchemas["ConversationEnvelope"]
export type TransportConversationListEnvelope =
  PersonalChatTransportSchemas["ConversationListEnvelope"]
export type TransportConversationParticipant =
  PersonalChatTransportSchemas["ConversationParticipant"]
export type TransportMessage = PersonalChatTransportSchemas["Message"]
export type TransportMessageEnvelope =
  PersonalChatTransportSchemas["MessageEnvelope"]
export type TransportMessageListEnvelope =
  PersonalChatTransportSchemas["MessageListEnvelope"]
export type TransportErrorResponse = PersonalChatTransportSchemas["ErrorResponse"]
export type TransportUser = PersonalChatTransportSchemas["User"]
export type TransportUserListResponse =
  PersonalChatTransportSchemas["UserListResponse"]
export type TransportUserEnvelopeResponse =
  PersonalChatTransportSchemas["UserEnvelopeResponse"]
export type TransportUserSummary = PersonalChatTransportSchemas["UserSummary"]
export type TransportUserSummaryListResponse =
  PersonalChatTransportSchemas["UserSummaryListResponse"]
export type TransportConversationPath =
  PersonalChatTransportPaths["/conversations/{id}"]
