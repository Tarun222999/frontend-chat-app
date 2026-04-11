import {
  PersonalChatBadRequestError,
  PersonalChatConversationNotFoundError,
  PersonalChatInvalidCredentialsError,
} from "./personal-chat-service"
import { GatewayHttpError } from "./gateway-http"

export const isGatewayHttpError = (error: unknown): error is GatewayHttpError =>
  error instanceof GatewayHttpError

export const isGatewayStatus = (error: unknown, status: number) =>
  isGatewayHttpError(error) && error.status === status

export const isGatewayBadRequestError = (
  error: unknown,
): error is GatewayHttpError =>
  isGatewayHttpError(error) && (error.status === 400 || error.status === 422)

export const mapGatewayBadRequestError = (error: GatewayHttpError) =>
  new PersonalChatBadRequestError(error.body?.message ?? error.message)

export const mapGatewayConversationNotFoundError = (conversationId: string) =>
  new PersonalChatConversationNotFoundError(conversationId)

export const mapGatewayLoginError = (error: unknown) => {
  if (isGatewayStatus(error, 401)) {
    return new PersonalChatInvalidCredentialsError()
  }

  if (isGatewayBadRequestError(error)) {
    return mapGatewayBadRequestError(error)
  }

  return error
}
