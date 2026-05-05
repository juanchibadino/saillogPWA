import { NextResponse } from "next/server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { Json } from "@/types/database"

import {
  verifyPaypalWebhookSignature,
  type PaypalWebhookVerificationResult,
} from "@/lib/billing/paypal"
import { syncOrganizationSubscriptionFromPaypal } from "@/lib/billing/subscription-sync"

type PaypalWebhookResource = {
  id?: string
  custom_id?: string
}

type PaypalWebhookEvent = {
  id?: string
  event_type?: string
  resource?: PaypalWebhookResource
}

function getRequiredHeader(headers: Headers, key: string): string | null {
  const value = headers.get(key)

  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function markWebhookEventAsProcessed(input: {
  eventId: string
  verificationStatus: string
  processedAt?: string
  processingError?: string
  organizationId?: string | null
  resourceId?: string | null
}): Promise<void> {
  const adminSupabase = createAdminSupabaseClient()
  await adminSupabase
    .from("paypal_webhook_events")
    .update({
      verification_status: input.verificationStatus,
      processed_at: input.processedAt ?? null,
      processing_error: input.processingError ?? null,
      organization_id: input.organizationId ?? null,
      resource_id: input.resourceId ?? null,
    })
    .eq("event_id", input.eventId)
}

function isDuplicateError(errorCode: string | undefined): boolean {
  return errorCode === "23505"
}

export async function POST(request: Request) {
  const payloadText = await request.text()
  let parsedPayload: PaypalWebhookEvent

  try {
    parsedPayload = JSON.parse(payloadText || "{}") as PaypalWebhookEvent
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const eventId = parsedPayload.id?.trim()
  const eventType = parsedPayload.event_type?.trim()

  if (!eventId || !eventType) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const adminSupabase = createAdminSupabaseClient()
  const { error: insertEventError } = await adminSupabase
    .from("paypal_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      resource_id: parsedPayload.resource?.id ?? null,
      payload: parsedPayload as Json,
      verification_status: "pending",
    })

  if (insertEventError) {
    if (isDuplicateError(insertEventError.code)) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    return NextResponse.json({ error: "webhook_persist_failed" }, { status: 500 })
  }

  const transmissionId = getRequiredHeader(request.headers, "paypal-transmission-id")
  const transmissionTime = getRequiredHeader(request.headers, "paypal-transmission-time")
  const transmissionSig = getRequiredHeader(request.headers, "paypal-transmission-sig")
  const certUrl = getRequiredHeader(request.headers, "paypal-cert-url")
  const authAlgo = getRequiredHeader(request.headers, "paypal-auth-algo")

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    await markWebhookEventAsProcessed({
      eventId,
      verificationStatus: "FAILED",
      processingError: "Missing one or more PayPal transmission headers.",
    })

    return NextResponse.json({ error: "invalid_headers" }, { status: 400 })
  }

  let verification: PaypalWebhookVerificationResult

  try {
    verification = await verifyPaypalWebhookSignature({
      transmissionId,
      transmissionTime,
      transmissionSig,
      certUrl,
      authAlgo,
      webhookEvent: parsedPayload,
    })
  } catch (error) {
    await markWebhookEventAsProcessed({
      eventId,
      verificationStatus: "ERROR",
      processingError:
        error instanceof Error ? error.message : "Webhook signature verification failed.",
    })

    return NextResponse.json({ error: "verification_failed" }, { status: 500 })
  }

  if (!verification.verified) {
    await markWebhookEventAsProcessed({
      eventId,
      verificationStatus: verification.verificationStatus,
      processingError: "Webhook signature could not be verified.",
    })

    return NextResponse.json({ error: "verification_failed" }, { status: 400 })
  }

  const resourceId = parsedPayload.resource?.id?.trim()

  if (!resourceId) {
    await markWebhookEventAsProcessed({
      eventId,
      verificationStatus: verification.verificationStatus,
      processedAt: new Date().toISOString(),
      resourceId: null,
    })

    return NextResponse.json({ received: true, processed: true, skipped: true })
  }

  try {
    const syncResult = await syncOrganizationSubscriptionFromPaypal({
      subscriptionId: resourceId,
      eventType,
      fallbackOrganizationId: parsedPayload.resource?.custom_id,
    })

    await markWebhookEventAsProcessed({
      eventId,
      verificationStatus: verification.verificationStatus,
      processedAt: new Date().toISOString(),
      resourceId,
      organizationId: syncResult.organizationId,
    })

    return NextResponse.json({
      received: true,
      processed: true,
      organizationId: syncResult.organizationId,
    })
  } catch (error) {
    await markWebhookEventAsProcessed({
      eventId,
      verificationStatus: verification.verificationStatus,
      resourceId,
      processingError:
        error instanceof Error
          ? error.message
          : "Could not process subscription update from webhook.",
    })

    return NextResponse.json({
      received: true,
      processed: false,
    })
  }
}
