import { createHmac, timingSafeEqual } from "node:crypto"

export const UPDATE_NOTIFICATION_UNSUBSCRIBE_PURPOSE = "update_notifications"

function encodeBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

function decodeBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
}

function signTokenPayload(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

function hasUsableSecret(secret) {
  return typeof secret === "string" && secret.trim().length > 0
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function signaturesMatch(expectedSignature, receivedSignature) {
  try {
    const expected = Buffer.from(expectedSignature, "base64url")
    const received = Buffer.from(receivedSignature, "base64url")

    return expected.length === received.length && timingSafeEqual(expected, received)
  } catch {
    return false
  }
}

export function signUpdateNotificationUnsubscribeToken({
  issuedAt = Math.floor(Date.now() / 1000),
  profileId,
  secret,
}) {
  if (!hasUsableSecret(secret)) {
    throw new Error("Missing EMAIL_UNSUBSCRIBE_SECRET")
  }

  if (!isNonEmptyString(profileId)) {
    throw new Error("Missing profileId")
  }

  const payload = {
    iat: issuedAt,
    profileId: profileId.trim(),
    purpose: UPDATE_NOTIFICATION_UNSUBSCRIBE_PURPOSE,
  }
  const encodedPayload = encodeBase64UrlJson(payload)
  const signature = signTokenPayload(encodedPayload, secret.trim())

  return `${encodedPayload}.${signature}`
}

export function verifyUpdateNotificationUnsubscribeToken({ token, secret }) {
  if (!hasUsableSecret(secret) || !isNonEmptyString(token)) {
    return {
      ok: false,
    }
  }

  const [encodedPayload, receivedSignature, extraPart] = token.split(".")

  if (!encodedPayload || !receivedSignature || extraPart) {
    return {
      ok: false,
    }
  }

  const expectedSignature = signTokenPayload(encodedPayload, secret.trim())

  if (!signaturesMatch(expectedSignature, receivedSignature)) {
    return {
      ok: false,
    }
  }

  try {
    const payload = decodeBase64UrlJson(encodedPayload)

    if (
      payload?.purpose !== UPDATE_NOTIFICATION_UNSUBSCRIBE_PURPOSE ||
      !isNonEmptyString(payload.profileId) ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat < 0
    ) {
      return {
        ok: false,
      }
    }

    return {
      issuedAt: payload.iat,
      ok: true,
      profileId: payload.profileId.trim(),
    }
  } catch {
    return {
      ok: false,
    }
  }
}

export function buildUpdateNotificationListUnsubscribeHeaders(unsubscribeUrl) {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
