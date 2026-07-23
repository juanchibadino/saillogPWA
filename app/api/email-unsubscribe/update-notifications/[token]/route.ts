import { NextResponse } from "next/server"

import { verifyUpdateNotificationUnsubscribeToken } from "@/features/notifications/email-unsubscribe-token.mjs"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    token: string
  }>
}

function getOptionalEnvironmentValue(variableName: string): string | undefined {
  const value = process.env[variableName]?.trim()
  return value && value.length > 0 ? value : undefined
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function buildHtmlResponse(input: {
  actionPath?: string
  body: string
  showForm?: boolean
  title: string
}): NextResponse {
  const actionPath = input.actionPath ? escapeHtml(input.actionPath) : ""
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)} - Dock Out</title>
  </head>
  <body style="margin: 0; background: #f9fafb; color: #111827; font-family: Inter, Arial, sans-serif;">
    <main style="box-sizing: border-box; max-width: 520px; margin: 0 auto; padding: 48px 24px;">
      <img
        src="/icons/apple-touch-icon.png"
        alt="Dock Out"
        width="56"
        height="56"
        style="display: block; width: 56px; height: 56px; border-radius: 18px; margin: 0 0 20px;"
      />
      <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.15; font-weight: 700;">
        ${escapeHtml(input.title)}
      </h1>
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #4b5563;">
        ${escapeHtml(input.body)}
      </p>
      ${
        input.showForm && actionPath
          ? `<form method="post" action="${actionPath}" style="margin: 0 0 24px;">
        <input type="hidden" name="List-Unsubscribe" value="One-Click" />
        <button
          type="submit"
          style="display: inline-block; border: 0; padding: 14px 20px; background: #111827; color: #ffffff; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer;"
        >
          Unsubscribe from update emails
        </button>
      </form>`
          : ""
      }
      <p style="margin: 32px 0 0; font-size: 14px; color: #6b7280;">
        You can manage Dock Out update emails from
        <a href="/settings?tab=notifications" style="color: #111827; font-weight: 600;">Settings</a>.
      </p>
    </main>
  </body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
    status: 200,
  })
}

function verifyToken(token: string): string | null {
  const secret = getOptionalEnvironmentValue("EMAIL_UNSUBSCRIBE_SECRET")

  if (!secret) {
    console.warn("Update email unsubscribe skipped: EMAIL_UNSUBSCRIBE_SECRET is not configured")
    return null
  }

  const result = verifyUpdateNotificationUnsubscribeToken({
    secret,
    token,
  })

  return result.ok ? result.profileId : null
}

function wantsHtml(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html")
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params
  const profileId = verifyToken(token)
  const actionPath = new URL(request.url).pathname

  if (!profileId) {
    return buildHtmlResponse({
      body: "This link could not be verified. Sign in to manage your email notification preferences.",
      title: "Manage Email Notifications",
    })
  }

  return buildHtmlResponse({
    actionPath,
    body: "Confirm that you want to stop receiving Dock Out update emails. This does not affect sign-in, invite, or account security emails.",
    showForm: true,
    title: "Manage Email Notifications",
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params
  const profileId = verifyToken(token)

  if (profileId) {
    try {
      const adminSupabase = createAdminSupabaseClient()
      const { error } = await adminSupabase
        .from("profiles")
        .update({
          email_notifications_enabled: false,
        })
        .eq("id", profileId)

      if (error) {
        console.warn("Failed to disable update email notifications", error)
      }
    } catch (error) {
      console.warn("Failed to process update email unsubscribe request", error)
    }
  }

  if (wantsHtml(request)) {
    return buildHtmlResponse({
      body: "Your Dock Out update email preference has been updated. This does not affect sign-in, invite, or account security emails.",
      title: "Email Notifications Updated",
    })
  }

  return NextResponse.json(
    {
      ok: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status: 202,
    },
  )
}
