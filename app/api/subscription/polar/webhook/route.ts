import { NextResponse } from "next/server"
import { WebhookVerificationError } from "@polar-sh/sdk/webhooks"

import {
  processPolarWebhookPayload,
  validatePolarWebhookPayload,
} from "@/lib/billing/polar"

export async function POST(request: Request) {
  const body = await request.text()
  const eventId = request.headers.get("webhook-id")?.trim()

  if (!eventId) {
    return NextResponse.json({ received: false, error: "missing_event_id" }, { status: 400 })
  }

  try {
    const payload = await validatePolarWebhookPayload({
      body,
      headers: request.headers,
    })
    await processPolarWebhookPayload({
      payload,
      eventId,
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ received: false }, { status: 403 })
    }

    return NextResponse.json(
      {
        received: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not process Polar webhook event.",
      },
      { status: 500 },
    )
  }
}
