import "server-only"

import { Resend } from "resend"

import {
  buildCampGoalEmailPayload,
  getCampGoalEmailRecipients,
} from "@/features/notifications/camp-goal-core.mjs"

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
  recipients: CampGoalEmailRecipient[]
  targetHref: string
  targetUrl: string
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

  const emailPayload = buildCampGoalEmailPayload({
    actorName: input.actorName,
    campName: input.campName,
    message: input.message,
    targetHref: input.targetHref,
    targetUrl: input.targetUrl,
  })
  const resend = new Resend(apiKey)
  const recipients = getCampGoalEmailRecipients(input.recipients)
  let sentCount = 0

  for (const recipient of recipients) {
    try {
      const { error } = await resend.emails.send({
        from: buildDockOutSenderAddress(from),
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
