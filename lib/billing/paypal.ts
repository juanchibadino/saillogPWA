import "server-only"

import { getOptionalAppUrlOrigin } from "@/lib/supabase/env"
import type { Database } from "@/types/database"

import type { BillingCycle, SubscriptionStatus } from "./plans"

type PaypalEnvironment = "sandbox" | "live"

type ProBillingCycle = Exclude<BillingCycle, "none">

type PaypalAccessTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type PaypalErrorResponse = {
  name?: string
  message?: string
}

export type PaypalSubscription = {
  id: string
  status: string
  plan_id?: string
  custom_id?: string
  start_time?: string
  billing_info?: {
    next_billing_time?: string
  }
}

type PaypalWebhookVerificationResponse = {
  verification_status?: string
}

type PaypalConfig = {
  environment: PaypalEnvironment
  apiBaseUrl: string
  clientId: string
  clientSecret: string
  webhookId: string
  proMonthlyPlanId: string
  proYearlyPlanId: string
}

export type PaypalWebhookVerificationInput = {
  transmissionId: string
  transmissionTime: string
  transmissionSig: string
  certUrl: string
  authAlgo: string
  webhookEvent: unknown
}

export type PaypalWebhookVerificationResult = {
  verificationStatus: string
  verified: boolean
}

const PAYPAL_ENVIRONMENTS: Record<PaypalEnvironment, { apiBaseUrl: string }> = {
  sandbox: {
    apiBaseUrl: "https://api-m.sandbox.paypal.com",
  },
  live: {
    apiBaseUrl: "https://api-m.paypal.com",
  },
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

function getPaypalEnvironment(): PaypalEnvironment {
  const configuredEnv = getOptionalEnvValue("PAYPAL_ENV")?.toLowerCase()

  if (!configuredEnv) {
    return "sandbox"
  }

  if (configuredEnv === "sandbox" || configuredEnv === "live") {
    return configuredEnv
  }

  throw new Error("Invalid PAYPAL_ENV value. Allowed values are sandbox or live.")
}

export function getPaypalClientId(): string {
  return getRequiredEnvValue("PAYPAL_CLIENT_ID")
}

function getPaypalConfig(): PaypalConfig {
  const environment = getPaypalEnvironment()
  const environmentConfig = PAYPAL_ENVIRONMENTS[environment]

  return {
    environment,
    apiBaseUrl: environmentConfig.apiBaseUrl,
    clientId: getRequiredEnvValue("PAYPAL_CLIENT_ID"),
    clientSecret: getRequiredEnvValue("PAYPAL_CLIENT_SECRET"),
    webhookId: getRequiredEnvValue("PAYPAL_WEBHOOK_ID"),
    proMonthlyPlanId: getRequiredEnvValue("PAYPAL_PRO_MONTHLY_PLAN_ID"),
    proYearlyPlanId: getRequiredEnvValue("PAYPAL_PRO_YEARLY_PLAN_ID"),
  }
}

export function getPaypalJsSdkUrl(): string {
  const clientId = getPaypalClientId()
  const environment = getPaypalEnvironment()
  const components = new URLSearchParams({
    "client-id": clientId,
    vault: "true",
    intent: "subscription",
    currency: "USD",
    components: "buttons",
  })

  if (environment === "sandbox") {
    components.set("debug", "false")
  }

  return `https://www.paypal.com/sdk/js?${components.toString()}`
}

export function resolvePaypalProPlanId(billingCycle: ProBillingCycle): string {
  const config = getPaypalConfig()

  if (billingCycle === "monthly") {
    return config.proMonthlyPlanId
  }

  return config.proYearlyPlanId
}

export function resolveBillingCycleFromPaypalPlanId(
  paypalPlanId: string,
): ProBillingCycle | null {
  const config = getPaypalConfig()

  if (paypalPlanId === config.proMonthlyPlanId) {
    return "monthly"
  }

  if (paypalPlanId === config.proYearlyPlanId) {
    return "yearly"
  }

  return null
}

export function mapPaypalSubscriptionStatus(
  paypalStatus: string,
): SubscriptionStatus {
  const normalizedStatus = paypalStatus.trim().toUpperCase()

  if (normalizedStatus === "ACTIVE") {
    return "active"
  }

  if (normalizedStatus === "APPROVAL_PENDING" || normalizedStatus === "CREATED") {
    return "approval_pending"
  }

  if (normalizedStatus === "APPROVED") {
    return "approved"
  }

  if (normalizedStatus === "SUSPENDED") {
    return "suspended"
  }

  if (normalizedStatus === "CANCELLED") {
    return "cancelled"
  }

  if (normalizedStatus === "EXPIRED") {
    return "expired"
  }

  return "approval_pending"
}

function buildApiUrl(path: string): string {
  const config = getPaypalConfig()
  return `${config.apiBaseUrl}${path}`
}

async function getPaypalAccessToken(): Promise<string> {
  const config = getPaypalConfig()
  const encodedCredentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64")

  const response = await fetch(buildApiUrl("/v1/oauth2/token"), {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | PaypalErrorResponse
      | null

    throw new Error(
      `Could not authenticate with PayPal: ${errorPayload?.message ?? response.statusText}`,
    )
  }

  const payload = (await response.json()) as PaypalAccessTokenResponse

  if (!payload.access_token) {
    throw new Error("PayPal OAuth response is missing access_token.")
  }

  return payload.access_token
}

async function paypalApiRequest<TResponse>(input: {
  path: string
  method?: "GET" | "POST"
  body?: unknown
}): Promise<TResponse> {
  const accessToken = await getPaypalAccessToken()
  const response = await fetch(buildApiUrl(input.path), {
    method: input.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | PaypalErrorResponse
      | null

    throw new Error(
      `PayPal API request failed for ${input.path}: ${errorPayload?.message ?? response.statusText}`,
    )
  }

  return (await response.json()) as TResponse
}

export async function fetchPaypalSubscription(
  subscriptionId: string,
): Promise<PaypalSubscription> {
  const trimmedSubscriptionId = subscriptionId.trim()

  if (trimmedSubscriptionId.length === 0) {
    throw new Error("A valid PayPal subscription id is required.")
  }

  return await paypalApiRequest<PaypalSubscription>({
    path: `/v1/billing/subscriptions/${encodeURIComponent(trimmedSubscriptionId)}`,
  })
}

export async function verifyPaypalWebhookSignature(
  input: PaypalWebhookVerificationInput,
): Promise<PaypalWebhookVerificationResult> {
  const config = getPaypalConfig()

  const payload = await paypalApiRequest<PaypalWebhookVerificationResponse>({
    path: "/v1/notifications/verify-webhook-signature",
    method: "POST",
    body: {
      transmission_id: input.transmissionId,
      transmission_time: input.transmissionTime,
      transmission_sig: input.transmissionSig,
      cert_url: input.certUrl,
      auth_algo: input.authAlgo,
      webhook_id: config.webhookId,
      webhook_event: input.webhookEvent,
    },
  })

  const verificationStatus = payload.verification_status ?? "UNKNOWN"

  return {
    verificationStatus,
    verified: verificationStatus.toUpperCase() === "SUCCESS",
  }
}

export function resolveBillingReturnUrlOrigin(requestUrl: string): string {
  const configuredOrigin = getOptionalAppUrlOrigin()

  if (configuredOrigin) {
    return configuredOrigin
  }

  return new URL(requestUrl).origin
}

export function buildPaypalReturnUrls(input: {
  requestUrl: string
  organizationId: string
}): {
  returnUrl: string
  cancelUrl: string
} {
  const origin = resolveBillingReturnUrlOrigin(input.requestUrl)
  const encodedOrgId = encodeURIComponent(input.organizationId)

  return {
    returnUrl: `${origin}/api/billing/paypal/return?org=${encodedOrgId}`,
    cancelUrl: `${origin}/api/billing/paypal/cancel?org=${encodedOrgId}`,
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export function getSubscriptionStatusFromEventType(input: {
  eventType: string
  paypalStatus: string
}): SubscriptionStatus {
  const normalizedEvent = input.eventType.trim().toUpperCase()

  if (normalizedEvent === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
    return "payment_failed"
  }

  return mapPaypalSubscriptionStatus(input.paypalStatus)
}

export type PaypalSubscriptionSyncResult = {
  organizationId: string
  planTier: Database["public"]["Enums"]["plan_tier"]
  billingCycle: Exclude<BillingCycle, "none">
  status: SubscriptionStatus
  paypalPlanId: string
  paypalSubscriptionId: string
  currentPeriodStartAt: string | null
  currentPeriodEndAt: string | null
}
