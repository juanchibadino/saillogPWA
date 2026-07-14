import "server-only"

import { Polar } from "@polar-sh/sdk"
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks"
import type { Order } from "@polar-sh/sdk/models/components/order"
import type { Subscription } from "@polar-sh/sdk/models/components/subscription"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/database"

import {
  buildPolarOrdersListRequestCore,
  mapPolarSubscriptionStatusCore,
  resolveBillingCycleFromPolarIntervalCore,
} from "./polar-core.mjs"
import type { BillingCycle, SubscriptionStatus } from "./plans"

type PolarServer = "sandbox" | "production"

type PolarConfig = {
  accessToken: string
  webhookSecret: string
  server: PolarServer
  proMonthlyProductId: string
}

export type PolarInvoiceSummary = {
  id: string
  createdAt: string
  invoiceNumber: string
  amountLabel: string
  status: string
  paid: boolean
  productName: string
}

export type PolarSubscriptionSyncResult = {
  organizationId: string
  planTier: "pro"
  billingCycle: Exclude<BillingCycle, "none">
  status: SubscriptionStatus
  polarCustomerId: string
  polarSubscriptionId: string
  polarProductId: string
  polarCheckoutId: string | null
  currentPeriodStartAt: string
  currentPeriodEndAt: string
}

type PolarWebhookPayload = ReturnType<typeof validateEvent>
type PolarSubscriptionWebhookPayload = PolarWebhookPayload & {
  type: `subscription.${string}`
  data: Subscription
}

function getOptionalEnvValue(name: string): string | undefined {
  const value = process.env[name]
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getRequiredEnvValue(name: string): string {
  const value = getOptionalEnvValue(name)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getPolarServer(): PolarServer {
  const configuredServer = getOptionalEnvValue("POLAR_SERVER")?.toLowerCase()

  if (!configuredServer) {
    return "sandbox"
  }

  if (configuredServer === "sandbox" || configuredServer === "production") {
    return configuredServer
  }

  throw new Error("Invalid POLAR_SERVER value. Allowed values are sandbox or production.")
}

export function getPolarConfig(): PolarConfig {
  return {
    accessToken: getRequiredEnvValue("POLAR_ACCESS_TOKEN"),
    webhookSecret: getRequiredEnvValue("POLAR_WEBHOOK_SECRET"),
    server: getPolarServer(),
    proMonthlyProductId: getRequiredEnvValue("POLAR_PRO_MONTHLY_PRODUCT_ID"),
  }
}

function getPolarClient(): Polar {
  const config = getPolarConfig()
  return new Polar({
    accessToken: config.accessToken,
    server: config.server,
  })
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function requireIsoString(value: Date, label: string): string {
  const isoValue = toIsoString(value)

  if (!isoValue) {
    throw new Error(`Polar subscription is missing ${label}.`)
  }

  return isoValue
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export function mapPolarSubscriptionStatus(status: string): SubscriptionStatus {
  return mapPolarSubscriptionStatusCore(status) as SubscriptionStatus
}

export function resolveBillingCycleFromPolarInterval(
  interval: string,
): Exclude<BillingCycle, "none"> {
  return resolveBillingCycleFromPolarIntervalCore(interval) as Exclude<
    BillingCycle,
    "none"
  >
}

export function buildPolarOrdersListRequest(organizationId: string): {
  externalCustomerId: string
  productBillingType: "recurring"
  productId: string
  sorting: ["-created_at"]
  limit: 50
} {
  return buildPolarOrdersListRequestCore({
    organizationId,
    productId: getRequiredEnvValue("POLAR_PRO_MONTHLY_PRODUCT_ID"),
  }) as {
    externalCustomerId: string
    productBillingType: "recurring"
    productId: string
    sorting: ["-created_at"]
    limit: 50
  }
}

export async function createPolarProCheckout(input: {
  organizationId: string
  organizationName: string
  customerEmail?: string | null
  origin: string
}): Promise<{
  checkoutId: string
  checkoutUrl: string
  polarCustomerId: string | null
}> {
  const polar = getPolarClient()
  const config = getPolarConfig()
  const scopedSubscriptionPath = `/subscription?org=${encodeURIComponent(
    input.organizationId,
  )}&tab=billing`
  const successUrl = `${input.origin}${scopedSubscriptionPath}&status=subscription_updated&checkout_id={CHECKOUT_ID}`
  const returnUrl = `${input.origin}${scopedSubscriptionPath}`
  const checkout = await polar.checkouts.create({
    products: [config.proMonthlyProductId],
    externalCustomerId: input.organizationId,
    customerName: input.organizationName,
    customerEmail: input.customerEmail ?? undefined,
    metadata: {
      organization_id: input.organizationId,
      plan_tier: "pro",
    },
    customerMetadata: {
      sailog_organization_id: input.organizationId,
    },
    successUrl,
    returnUrl,
  })

  return {
    checkoutId: checkout.id,
    checkoutUrl: checkout.url,
    polarCustomerId: checkout.customerId,
  }
}

function formatAmountLabel(input: { amount: number; currency: string }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: input.currency.toUpperCase(),
  }).format(input.amount / 100)
}

export function mapPolarOrderToInvoiceSummary(order: Order): PolarInvoiceSummary {
  return {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    invoiceNumber: order.invoiceNumber || order.id,
    amountLabel: formatAmountLabel({
      amount: order.totalAmount,
      currency: order.currency,
    }),
    status: order.status,
    paid: order.paid,
    productName: order.product?.name ?? order.description,
  }
}

export async function listPolarInvoicesForOrganization(
  organizationId: string,
): Promise<PolarInvoiceSummary[]> {
  const polar = getPolarClient()
  const page = await polar.orders.list(buildPolarOrdersListRequest(organizationId))

  return page.result.items.map(mapPolarOrderToInvoiceSummary)
}

export async function getPolarOrderInvoiceUrl(input: {
  organizationId: string
  orderId: string
}): Promise<string> {
  const polar = getPolarClient()
  const order = await polar.orders.get({ id: input.orderId })

  if (order.customer.externalId !== input.organizationId) {
    throw new Error("Polar order does not belong to the active organization.")
  }

  const invoice = await polar.orders.invoice({ id: input.orderId })
  return invoice.url
}

export async function createPolarCustomerPortalUrl(input: {
  organizationId: string
  origin: string
}): Promise<string> {
  const polar = getPolarClient()
  const session = await polar.customerSessions.create({
    externalCustomerId: input.organizationId,
    returnUrl: `${input.origin}/subscription?org=${encodeURIComponent(
      input.organizationId,
    )}&tab=billing`,
  })

  return session.customerPortalUrl
}

function getMetadataString(
  metadata: Subscription["metadata"],
  key: string,
): string | null {
  const value = metadata[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function getSubscriptionOrganizationId(subscription: Subscription): string | null {
  const customerExternalId = subscription.customer.externalId?.trim()
  if (customerExternalId && isUuid(customerExternalId)) {
    return customerExternalId
  }

  const metadataOrganizationId = getMetadataString(subscription.metadata, "organization_id")
  return metadataOrganizationId && isUuid(metadataOrganizationId)
    ? metadataOrganizationId
    : null
}

function isPolarSubscriptionWebhookPayload(
  payload: PolarWebhookPayload,
): payload is PolarSubscriptionWebhookPayload {
  return (
    payload.type.startsWith("subscription.") &&
    "data" in payload &&
    typeof (payload.data as { id?: unknown }).id === "string" &&
    typeof (payload.data as { status?: unknown }).status === "string"
  )
}

function buildPolarSubscriptionSyncResult(
  subscription: Subscription,
): PolarSubscriptionSyncResult | null {
  const config = getPolarConfig()

  if (subscription.productId !== config.proMonthlyProductId) {
    return null
  }

  const organizationId = getSubscriptionOrganizationId(subscription)

  if (!organizationId) {
    return null
  }

  return {
    organizationId,
    planTier: "pro",
    billingCycle: resolveBillingCycleFromPolarInterval(subscription.recurringInterval),
    status: mapPolarSubscriptionStatus(subscription.status),
    polarCustomerId: subscription.customerId,
    polarSubscriptionId: subscription.id,
    polarProductId: subscription.productId,
    polarCheckoutId: subscription.checkoutId,
    currentPeriodStartAt: requireIsoString(
      subscription.currentPeriodStart,
      "current period start",
    ),
    currentPeriodEndAt: requireIsoString(
      subscription.currentPeriodEnd,
      "current period end",
    ),
  }
}

function toJsonPayload(
  payload: unknown,
): Database["public"]["Tables"]["polar_webhook_events"]["Insert"]["payload"] {
  return JSON.parse(JSON.stringify(payload)) as Database["public"]["Tables"]["polar_webhook_events"]["Insert"]["payload"]
}

export async function validatePolarWebhookPayload(input: {
  body: string
  headers: Headers
}): Promise<PolarWebhookPayload> {
  const config = getPolarConfig()
  const webhookHeaders = {
    "webhook-id": input.headers.get("webhook-id") ?? "",
    "webhook-timestamp": input.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": input.headers.get("webhook-signature") ?? "",
  }

  try {
    return validateEvent(input.body, webhookHeaders, config.webhookSecret)
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      throw error
    }

    throw new Error("Could not validate Polar webhook payload.")
  }
}

export async function processPolarWebhookPayload(input: {
  payload: PolarWebhookPayload
  eventId: string
}): Promise<{ processed: boolean; organizationId: string | null }> {
  const adminSupabase = createAdminSupabaseClient()
  const subscription = isPolarSubscriptionWebhookPayload(input.payload)
    ? input.payload.data
    : null
  const organizationId = subscription ? getSubscriptionOrganizationId(subscription) : null
  const resourceId =
    subscription && typeof subscription.id === "string" ? subscription.id : null

  const { error: insertEventError } = await adminSupabase
    .from("polar_webhook_events")
    .insert({
      event_id: input.eventId,
      event_type: input.payload.type,
      resource_id: resourceId,
      organization_id: organizationId,
      payload: toJsonPayload(input.payload),
    })

  if (insertEventError) {
    if (insertEventError.code === "23505") {
      return {
        processed: false,
        organizationId,
      }
    }

    throw new Error(`Could not record Polar webhook event: ${insertEventError.message}`)
  }

  try {
    if (subscription) {
      const syncResult = buildPolarSubscriptionSyncResult(subscription)

      if (syncResult) {
        const { error: syncError } = await adminSupabase
          .from("organization_subscriptions")
          .upsert(
            {
              organization_id: syncResult.organizationId,
              plan_tier: syncResult.planTier,
              billing_cycle: syncResult.billingCycle,
              status: syncResult.status,
              paypal_subscription_id: null,
              paypal_plan_id: null,
              polar_customer_id: syncResult.polarCustomerId,
              polar_subscription_id: syncResult.polarSubscriptionId,
              polar_product_id: syncResult.polarProductId,
              polar_checkout_id: syncResult.polarCheckoutId,
              polar_status: subscription.status,
              current_period_start_at: syncResult.currentPeriodStartAt,
              current_period_end_at: syncResult.currentPeriodEndAt,
              cancelled_at: toIsoString(subscription.canceledAt),
              cancel_at_period_end: subscription.cancelAtPeriodEnd,
            },
            { onConflict: "organization_id" },
          )

        if (syncError) {
          throw new Error(`Could not sync Polar subscription: ${syncError.message}`)
        }
      }
    }

    const { error: updateEventError } = await adminSupabase
      .from("polar_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: null,
        organization_id: organizationId,
      })
      .eq("event_id", input.eventId)

    if (updateEventError) {
      throw new Error(`Could not update Polar webhook event: ${updateEventError.message}`)
    }

    return {
      processed: true,
      organizationId,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process Polar webhook event."
    await adminSupabase
      .from("polar_webhook_events")
      .update({
        processing_error: message,
        organization_id: organizationId,
      })
      .eq("event_id", input.eventId)

    throw error
  }
}
