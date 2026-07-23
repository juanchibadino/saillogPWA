import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import {
  buildUpdateNotificationListUnsubscribeHeaders,
  signUpdateNotificationUnsubscribeToken,
  verifyUpdateNotificationUnsubscribeToken,
} from "./email-unsubscribe-token.mjs"

function signCustomPayload(payload, secret) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url")

  return `${encodedPayload}.${signature}`
}

test("signs and verifies update-notification unsubscribe tokens", () => {
  const token = signUpdateNotificationUnsubscribeToken({
    issuedAt: 1784736000,
    profileId: "a2a4724e-3dd0-4dd9-84d7-dc34cd146a55",
    secret: "test-secret",
  })

  assert.deepEqual(
    verifyUpdateNotificationUnsubscribeToken({
      secret: "test-secret",
      token,
    }),
    {
      issuedAt: 1784736000,
      ok: true,
      profileId: "a2a4724e-3dd0-4dd9-84d7-dc34cd146a55",
    },
  )
})

test("rejects tampered and wrong-purpose unsubscribe tokens", () => {
  const token = signUpdateNotificationUnsubscribeToken({
    issuedAt: 1784736000,
    profileId: "a2a4724e-3dd0-4dd9-84d7-dc34cd146a55",
    secret: "test-secret",
  })
  const [payload, signature] = token.split(".")
  const wrongPurposeToken = signCustomPayload(
    {
      iat: 1784736000,
      profileId: "a2a4724e-3dd0-4dd9-84d7-dc34cd146a55",
      purpose: "marketing",
    },
    "test-secret",
  )

  assert.deepEqual(
    verifyUpdateNotificationUnsubscribeToken({
      secret: "test-secret",
      token: `${payload}x.${signature}`,
    }),
    { ok: false },
  )
  assert.deepEqual(
    verifyUpdateNotificationUnsubscribeToken({
      secret: "test-secret",
      token: wrongPurposeToken,
    }),
    { ok: false },
  )
  assert.deepEqual(
    verifyUpdateNotificationUnsubscribeToken({
      secret: "wrong-secret",
      token,
    }),
    { ok: false },
  )
})

test("builds standards-compliant one-click unsubscribe headers", () => {
  assert.deepEqual(
    buildUpdateNotificationListUnsubscribeHeaders(
      "https://www.dockout.app/api/email-unsubscribe/update-notifications/token",
    ),
    {
      "List-Unsubscribe":
        "<https://www.dockout.app/api/email-unsubscribe/update-notifications/token>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  )
})
