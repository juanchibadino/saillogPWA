import "server-only"

import webPush, { type PushSubscription as WebPushSubscription } from "web-push"

import type { Database, Json } from "@/types/database"

type PushSubscriptionRow = Pick<
  Database["public"]["Tables"]["push_subscriptions"]["Row"],
  "auth" | "endpoint" | "p256dh"
>

type WebPushPayload = {
  body: string
  tag: string
  title: string
  url: string
}

type SendWebPushNotificationsResult = {
  sentCount: number
  staleEndpoints: string[]
}

function getOptionalEnvironmentValue(variableName: string): string | undefined {
  const value = process.env[variableName]?.trim()
  return value && value.length > 0 ? value : undefined
}

function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null
  }

  const statusCode = Number((error as { statusCode?: unknown }).statusCode)
  return Number.isFinite(statusCode) ? statusCode : null
}

function configureWebPush(): boolean {
  const publicKey = getOptionalEnvironmentValue("NEXT_PUBLIC_VAPID_PUBLIC_KEY")
  const privateKey = getOptionalEnvironmentValue("VAPID_PRIVATE_KEY")
  const subject = getOptionalEnvironmentValue("VAPID_SUBJECT")

  if (!publicKey || !privateKey || !subject) {
    console.warn("Web push notifications skipped: VAPID is not configured")
    return false
  }

  webPush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

function toWebPushSubscription(row: PushSubscriptionRow): WebPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      auth: row.auth,
      p256dh: row.p256dh,
    },
  }
}

export async function sendWebPushNotifications(input: {
  payload: WebPushPayload
  subscriptions: PushSubscriptionRow[]
}): Promise<SendWebPushNotificationsResult> {
  if (input.subscriptions.length === 0 || !configureWebPush()) {
    return {
      sentCount: 0,
      staleEndpoints: [],
    }
  }

  const serializedPayload = JSON.stringify(input.payload satisfies Json)
  const staleEndpoints: string[] = []
  let sentCount = 0

  for (const subscription of input.subscriptions) {
    try {
      await webPush.sendNotification(
        toWebPushSubscription(subscription),
        serializedPayload,
      )
      sentCount += 1
    } catch (error) {
      const statusCode = getErrorStatusCode(error)

      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(subscription.endpoint)
        continue
      }

      console.warn("Failed to send web push notification", {
        endpoint: subscription.endpoint,
        error,
      })
    }
  }

  return {
    sentCount,
    staleEndpoints,
  }
}
