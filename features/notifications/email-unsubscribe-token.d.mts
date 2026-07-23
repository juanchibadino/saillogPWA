export const UPDATE_NOTIFICATION_UNSUBSCRIBE_PURPOSE: "update_notifications"

export function signUpdateNotificationUnsubscribeToken(input: {
  issuedAt?: number
  profileId: string
  secret: string
}): string

export function verifyUpdateNotificationUnsubscribeToken(input: {
  token: string
  secret: string
}):
  | {
      issuedAt: number
      ok: true
      profileId: string
    }
  | {
      ok: false
    }

export function buildUpdateNotificationListUnsubscribeHeaders(
  unsubscribeUrl: string,
): {
  "List-Unsubscribe": string
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
}
