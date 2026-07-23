import "server-only"

import { Resend } from "resend"

import {
  buildCampGoalEmailPayload,
  getCampGoalEmailRecipients,
} from "@/features/notifications/camp-goal-core.mjs"
import {
  buildUpdateNotificationListUnsubscribeHeaders,
  signUpdateNotificationUnsubscribeToken,
} from "@/features/notifications/email-unsubscribe-token.mjs"
import { getOptionalAppUrlOrigin } from "@/lib/supabase/env"

type CampGoalEmailRecipient = {
  email: string
  emailNotificationsEnabled: boolean
  name: string
  profileId: string
}

type SendCampGoalEmailNotificationsInput = {
  actorName: string
  campName: string
  message: string
  preferencesUrl: string
  recipients: CampGoalEmailRecipient[]
  targetHref: string
  targetUrl: string
}

type UnsubscribeHeaderConfig = {
  origin: string
  secret: string
}

function getOptionalEnvironmentValue(variableName: string): string | undefined {
  const value = process.env[variableName]?.trim()
  return value && value.length > 0 ? value : undefined
}

function buildDockOutSenderAddress(configuredFrom: string): string {
  const bracketMatch = configuredFrom.match(/<([^<>]+)>/)
  const emailAddress = (bracketMatch?.[1] ?? configuredFrom).trim()

  if (!emailAddress.includes("@")) {
    return configuredFrom
  }

  return `"Dock Out" <${emailAddress}>`
}

function isHttpsAppOrigin(origin: string): boolean {
  try {
    return new URL(origin).protocol === "https:"
  } catch {
    return false
  }
}

function getUnsubscribeHeaderConfig(): {
  config: UnsubscribeHeaderConfig | null
  warning: string | null
} {
  const secret = getOptionalEnvironmentValue("EMAIL_UNSUBSCRIBE_SECRET")

  if (!secret) {
    return {
      config: null,
      warning: "Camp goal email unsubscribe headers skipped: EMAIL_UNSUBSCRIBE_SECRET is not configured",
    }
  }

  try {
    const origin = getOptionalAppUrlOrigin()

    if (!origin) {
      return {
        config: null,
        warning:
          "Camp goal email unsubscribe headers skipped: NEXT_PUBLIC_APP_URL is not configured",
      }
    }

    if (!isHttpsAppOrigin(origin)) {
      return {
        config: null,
        warning:
          "Camp goal email unsubscribe headers skipped: NEXT_PUBLIC_APP_URL must be HTTPS",
      }
    }

    return {
      config: {
        origin,
        secret,
      },
      warning: null,
    }
  } catch (error) {
    return {
      config: null,
      warning:
        error instanceof Error
          ? `Camp goal email unsubscribe headers skipped: ${error.message}`
          : "Camp goal email unsubscribe headers skipped: NEXT_PUBLIC_APP_URL is invalid",
    }
  }
}

function buildRecipientUnsubscribeHeaders(
  recipient: CampGoalEmailRecipient,
  config: UnsubscribeHeaderConfig | null,
): Record<string, string> | undefined {
  if (!config) {
    return undefined
  }

  const token = signUpdateNotificationUnsubscribeToken({
    profileId: recipient.profileId,
    secret: config.secret,
  })
  const unsubscribeUrl = `${config.origin}/api/email-unsubscribe/update-notifications/${encodeURIComponent(token)}`

  return buildUpdateNotificationListUnsubscribeHeaders(unsubscribeUrl)
}

export async function sendCampGoalEmailNotifications(
  input: SendCampGoalEmailNotificationsInput,
): Promise<number> {
  const apiKey = getOptionalEnvironmentValue("RESEND_API_KEY")
  const from = getOptionalEnvironmentValue("NOTIFICATION_EMAIL_FROM")
  const replyTo = getOptionalEnvironmentValue("NOTIFICATION_EMAIL_REPLY_TO")

  if (!apiKey || !from) {
    console.warn("Camp goal email notifications skipped: Resend is not configured")
    return 0
  }

  const resend = new Resend(apiKey)
  const recipients = getCampGoalEmailRecipients(input.recipients)
  const { config: unsubscribeHeaderConfig, warning: unsubscribeHeaderWarning } =
    getUnsubscribeHeaderConfig()
  let sentCount = 0

  if (recipients.length > 0 && unsubscribeHeaderWarning) {
    console.warn(unsubscribeHeaderWarning)
  }

  for (const recipient of recipients) {
    try {
      const emailPayload = buildCampGoalEmailPayload({
        actorName: input.actorName,
        campName: input.campName,
        message: input.message,
        preferencesUrl: input.preferencesUrl,
        targetHref: input.targetHref,
        targetUrl: input.targetUrl,
      })
      const { error } = await resend.emails.send({
        from: buildDockOutSenderAddress(from),
        headers: buildRecipientUnsubscribeHeaders(recipient, unsubscribeHeaderConfig),
        html: emailPayload.html,
        replyTo,
        subject: emailPayload.subject,
        text: emailPayload.text,
        to: recipient.email,
      })

      if (error) {
        console.warn("Failed to send camp goal email notification", {
          error,
          profileId: recipient.profileId,
        })
        continue
      }

      sentCount += 1
    } catch (error) {
      console.warn("Failed to send camp goal email notification", {
        error,
        profileId: recipient.profileId,
      })
    }
  }

  return sentCount
}
