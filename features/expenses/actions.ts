"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import {
  canCreateTeamExpense,
  canMutateTeamExpense,
} from "@/features/expenses/data-core.mjs"
import { resolveExpenseRateSnapshot } from "@/features/expenses/exchange-rates"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  canManageTeamFinance,
  canManageTeamSessions,
} from "@/lib/auth/capabilities"
import { scopeFormInputSchema } from "@/lib/validation/navigation"
import {
  createTeamExpenseInputSchema,
  deleteTeamExpenseInputSchema,
  updateTeamExpenseInputSchema,
} from "@/lib/validation/expenses"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

const EXPENSE_RECEIPTS_BUCKET = "expense-receipts"
const RECEIPT_MIME_TYPE = "image/webp"
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024
const MAX_RECEIPT_THUMBNAIL_BYTES = 256 * 1024

type ExpenseMutationResult =
  | {
      ok: true
      message: string
    }
  | {
      ok: false
      message: string
    }

type ExpenseActionScope = {
  scopeOrgId?: string
  scopeTeamId?: string
}

type TeamExpenseRow = Pick<
  Database["public"]["Tables"]["team_expenses"]["Row"],
  | "id"
  | "team_id"
  | "team_venue_id"
  | "camp_id"
  | "created_by_profile_id"
  | "assigned_to_profile_id"
  | "receipt_bucket"
  | "receipt_storage_path"
  | "receipt_thumbnail_bucket"
  | "receipt_thumbnail_storage_path"
>

type ReceiptUploadMetadata = {
  receipt_bucket: string
  receipt_file_name: string
  receipt_mime_type: string
  receipt_size_bytes: number
  receipt_storage_path: string
  receipt_thumbnail_bucket: string
  receipt_thumbnail_mime_type: string
  receipt_thumbnail_size_bytes: number
  receipt_thumbnail_storage_path: string
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return undefined
  }

  return value
}

function getFormFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key)

  if (!(value instanceof File) || value.size <= 0) {
    return undefined
  }

  return value
}

function getScopeFromFormData(formData: FormData): ExpenseActionScope {
  const parsedScope = scopeFormInputSchema.safeParse({
    scopeOrgId: getFormString(formData, "scopeOrgId"),
    scopeTeamId: getFormString(formData, "scopeTeamId"),
  })

  if (!parsedScope.success) {
    return {}
  }

  return parsedScope.data
}

function buildError(message: string): ExpenseMutationResult {
  return {
    ok: false,
    message,
  }
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? ""

  return normalized.length > 0 ? normalized : null
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${sanitized || "receipt"}.webp`
}

function buildReceiptStoragePath(input: {
  expenseId: string
  fileName: string
  teamId: string
}): string {
  return `expenses/${input.teamId}/${input.expenseId}/receipt/${sanitizeFileName(input.fileName)}`
}

function buildReceiptThumbnailStoragePath(input: {
  expenseId: string
  fileName: string
  teamId: string
}): string {
  return `expenses/${input.teamId}/${input.expenseId}/thumbnail/${sanitizeFileName(input.fileName)}`
}

function hasAsciiSignature(fileBytes: Uint8Array, offset: number, signature: string): boolean {
  if (fileBytes.length < offset + signature.length) {
    return false
  }

  for (let index = 0; index < signature.length; index += 1) {
    if (fileBytes[offset + index] !== signature.charCodeAt(index)) {
      return false
    }
  }

  return true
}

function hasWebpFileSignature(fileBytes: Uint8Array): boolean {
  return hasAsciiSignature(fileBytes, 0, "RIFF") && hasAsciiSignature(fileBytes, 8, "WEBP")
}

async function loadScopedExpenseContext(input: {
  organizationId: string
  teamId: string
  teamVenueId: string
}): Promise<{
  organizationCurrencyCode: string
  teamVenueId: string
}> {
  const supabase = await createServerSupabaseClient()
  const [
    { data: teamVenueRow, error: teamVenueError },
    { data: organizationRow, error: organizationError },
  ] = await Promise.all([
    supabase
      .from("team_venues")
      .select("id,team_id,venue_id")
      .eq("id", input.teamVenueId)
      .eq("team_id", input.teamId)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("id,default_currency_code")
      .eq("id", input.organizationId)
      .eq("is_active", true)
      .maybeSingle(),
  ])

  if (teamVenueError || !teamVenueRow) {
    throw new Error("Invalid expense venue scope")
  }

  if (organizationError || !organizationRow) {
    throw new Error("Invalid expense organization scope")
  }

  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (teamError || !teamRow) {
    throw new Error("Invalid expense team scope")
  }

  return {
    organizationCurrencyCode: organizationRow.default_currency_code ?? "USD",
    teamVenueId: teamVenueRow.id,
  }
}

async function resolveAssignedExpenseProfileId(input: {
  actorProfileId: string
  assignedToProfileId?: string
  canManageTeamFinance: boolean
  teamId: string
}): Promise<{ assignedToProfileId: string } | { error: string }> {
  const assignedToProfileId = input.canManageTeamFinance
    ? input.assignedToProfileId
    : input.actorProfileId

  if (!assignedToProfileId) {
    return { error: "Select a team member for this expense." }
  }

  if (!input.canManageTeamFinance && assignedToProfileId !== input.actorProfileId) {
    return { error: "You can only assign expenses to yourself." }
  }

  const supabase = await createServerSupabaseClient()
  const { data: membershipRow, error: membershipError } = await supabase
    .from("team_memberships")
    .select("profile_id")
    .eq("team_id", input.teamId)
    .eq("profile_id", assignedToProfileId)
    .eq("is_active", true)
    .maybeSingle()

  if (membershipError || !membershipRow) {
    return { error: "Select an active team member for this expense." }
  }

  return { assignedToProfileId }
}

async function uploadReceiptFiles(input: {
  expenseId: string
  receiptFile: File
  thumbnailFile: File
  teamId: string
}): Promise<
  | {
      metadata: ReceiptUploadMetadata
      uploadedPaths: string[]
    }
  | { error: string }
> {
  if (
    input.receiptFile.type !== RECEIPT_MIME_TYPE ||
    input.thumbnailFile.type !== RECEIPT_MIME_TYPE ||
    input.receiptFile.size <= 0 ||
    input.receiptFile.size > MAX_RECEIPT_BYTES ||
    input.thumbnailFile.size <= 0 ||
    input.thumbnailFile.size > MAX_RECEIPT_THUMBNAIL_BYTES
  ) {
    return { error: "The receipt image is invalid." }
  }

  const [receiptBytes, thumbnailBytes] = await Promise.all([
    input.receiptFile.arrayBuffer(),
    input.thumbnailFile.arrayBuffer(),
  ])
  const receiptData = new Uint8Array(receiptBytes)
  const thumbnailData = new Uint8Array(thumbnailBytes)

  if (!hasWebpFileSignature(receiptData) || !hasWebpFileSignature(thumbnailData)) {
    return { error: "The receipt image could not be verified." }
  }

  const receiptStoragePath = buildReceiptStoragePath({
    expenseId: input.expenseId,
    fileName: input.receiptFile.name,
    teamId: input.teamId,
  })
  const thumbnailStoragePath = buildReceiptThumbnailStoragePath({
    expenseId: input.expenseId,
    fileName: input.thumbnailFile.name,
    teamId: input.teamId,
  })
  const adminSupabase = createAdminSupabaseClient()
  const uploadedPaths: string[] = []

  try {
    const { error: receiptUploadError } = await adminSupabase.storage
      .from(EXPENSE_RECEIPTS_BUCKET)
      .upload(receiptStoragePath, receiptData, {
        contentType: input.receiptFile.type,
        upsert: true,
      })

    if (receiptUploadError) {
      throw receiptUploadError
    }

    uploadedPaths.push(receiptStoragePath)

    const { error: thumbnailUploadError } = await adminSupabase.storage
      .from(EXPENSE_RECEIPTS_BUCKET)
      .upload(thumbnailStoragePath, thumbnailData, {
        contentType: input.thumbnailFile.type,
        upsert: true,
      })

    if (thumbnailUploadError) {
      throw thumbnailUploadError
    }

    uploadedPaths.push(thumbnailStoragePath)
  } catch {
    if (uploadedPaths.length > 0) {
      try {
        await adminSupabase.storage.from(EXPENSE_RECEIPTS_BUCKET).remove(uploadedPaths)
      } catch {
        // Best effort cleanup only.
      }
    }

    return { error: "Could not upload receipt. Confirm storage is available and try again." }
  }

  return {
    metadata: {
      receipt_bucket: EXPENSE_RECEIPTS_BUCKET,
      receipt_file_name: input.receiptFile.name,
      receipt_mime_type: input.receiptFile.type,
      receipt_size_bytes: input.receiptFile.size,
      receipt_storage_path: receiptStoragePath,
      receipt_thumbnail_bucket: EXPENSE_RECEIPTS_BUCKET,
      receipt_thumbnail_mime_type: input.thumbnailFile.type,
      receipt_thumbnail_size_bytes: input.thumbnailFile.size,
      receipt_thumbnail_storage_path: thumbnailStoragePath,
    },
    uploadedPaths,
  }
}

async function removeReceiptPaths(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return
  }

  try {
    await createAdminSupabaseClient().storage.from(EXPENSE_RECEIPTS_BUCKET).remove(paths)
  } catch {
    // Best effort cleanup only.
  }
}

function revalidateExpenseSurfaces(teamVenueId?: string | null): void {
  revalidatePath("/team-expenses")
  revalidatePath("/venues")

  if (teamVenueId) {
    revalidatePath(`/venues/${teamVenueId}`)
  }
}

export async function createTeamExpenseAction(
  formData: FormData,
): Promise<ExpenseMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const actorProfileId = context.profile?.id ?? context.user.id

  if (!scope.scopeOrgId || !scope.scopeTeamId) {
    return buildError("Team scope is required to create expenses.")
  }

  const parsedInput = createTeamExpenseInputSchema.safeParse({
    teamId: scope.scopeTeamId,
    teamVenueId: getFormString(formData, "teamVenueId"),
    assignedToProfileId: getFormString(formData, "assignedToProfileId"),
    campId: null,
    expenseDate: getFormString(formData, "expenseDate"),
    vendor: getFormString(formData, "vendor"),
    expenseType: getFormString(formData, "expenseType"),
    description: getFormString(formData, "description"),
    amountLocal: getFormString(formData, "amountLocal"),
    currencyCode: getFormString(formData, "currencyCode"),
  })

  if (!parsedInput.success) {
    return buildError("Review the expense fields and try again.")
  }

  const canManageSessions = canManageTeamSessions({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })
  const canManageFinance = canManageTeamFinance({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })
  const assignedProfileResult = await resolveAssignedExpenseProfileId({
    actorProfileId,
    assignedToProfileId: parsedInput.data.assignedToProfileId,
    canManageTeamFinance: canManageFinance,
    teamId: scope.scopeTeamId,
  })

  if ("error" in assignedProfileResult) {
    return buildError(assignedProfileResult.error)
  }

  if (
    !canCreateTeamExpense({
      actorProfileId,
      assignedToProfileId: assignedProfileResult.assignedToProfileId,
      canManageTeamFinance: canManageFinance,
      canManageTeamSessions: canManageSessions,
    })
  ) {
    return buildError("You do not have permission to create expenses for this team.")
  }

  let scopedContext: Awaited<ReturnType<typeof loadScopedExpenseContext>>

  try {
    scopedContext = await loadScopedExpenseContext({
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
      teamVenueId: parsedInput.data.teamVenueId,
    })
  } catch {
    return buildError("The selected venue is outside the active team scope.")
  }

  const supabase = await createServerSupabaseClient()
  let rateSnapshot: Awaited<ReturnType<typeof resolveExpenseRateSnapshot>>

  try {
    rateSnapshot = await resolveExpenseRateSnapshot({
      amountLocal: parsedInput.data.amountLocal,
      currencyCode: parsedInput.data.currencyCode,
      expenseDate: parsedInput.data.expenseDate,
      organizationCurrencyCode: scopedContext.organizationCurrencyCode,
      supabase,
    })
  } catch {
    return buildError("Could not resolve the exchange rate for this expense.")
  }

  const expenseId = randomUUID()
  const receiptFile = getFormFile(formData, "receiptFile")
  const thumbnailFile = getFormFile(formData, "receiptThumbnailFile")
  let receiptMetadata: ReceiptUploadMetadata | null = null
  let uploadedReceiptPaths: string[] = []

  if (receiptFile || thumbnailFile) {
    if (!receiptFile || !thumbnailFile) {
      return buildError("Select a receipt image before saving.")
    }

    const uploadResult = await uploadReceiptFiles({
      expenseId,
      receiptFile,
      thumbnailFile,
      teamId: scope.scopeTeamId,
    })

    if ("error" in uploadResult) {
      return buildError(uploadResult.error)
    }

    receiptMetadata = uploadResult.metadata
    uploadedReceiptPaths = uploadResult.uploadedPaths
  }

  const { error: insertError } = await supabase.from("team_expenses").insert({
    id: expenseId,
    team_id: scope.scopeTeamId,
    team_venue_id: parsedInput.data.teamVenueId,
    camp_id: null,
    created_by_profile_id: actorProfileId,
    assigned_to_profile_id: assignedProfileResult.assignedToProfileId,
    expense_date: parsedInput.data.expenseDate,
    vendor: parsedInput.data.vendor,
    expense_type: parsedInput.data.expenseType,
    description: normalizeOptionalText(parsedInput.data.description),
    amount_local: parsedInput.data.amountLocal,
    currency_code: parsedInput.data.currencyCode,
    organization_currency_code: rateSnapshot.organizationCurrencyCode,
    exchange_rate: rateSnapshot.exchangeRate,
    exchange_rate_date: rateSnapshot.exchangeRateDate,
    exchange_rate_source: rateSnapshot.exchangeRateSource,
    amount_organization_currency: rateSnapshot.amountOrganizationCurrency,
    ...(receiptMetadata ?? {}),
  })

  if (insertError) {
    await removeReceiptPaths(uploadedReceiptPaths)
    return buildError("Could not create expense. Confirm permissions and try again.")
  }

  revalidateExpenseSurfaces(parsedInput.data.teamVenueId)

  return {
    ok: true,
    message: "Expense created.",
  }
}

export async function updateTeamExpenseAction(
  formData: FormData,
): Promise<ExpenseMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const actorProfileId = context.profile?.id ?? context.user.id

  if (!scope.scopeOrgId || !scope.scopeTeamId) {
    return buildError("Team scope is required to update expenses.")
  }

  const parsedInput = updateTeamExpenseInputSchema.safeParse({
    expenseId: getFormString(formData, "expenseId"),
    teamId: scope.scopeTeamId,
    teamVenueId: getFormString(formData, "teamVenueId"),
    assignedToProfileId: getFormString(formData, "assignedToProfileId"),
    campId: null,
    expenseDate: getFormString(formData, "expenseDate"),
    vendor: getFormString(formData, "vendor"),
    expenseType: getFormString(formData, "expenseType"),
    description: getFormString(formData, "description"),
    amountLocal: getFormString(formData, "amountLocal"),
    currencyCode: getFormString(formData, "currencyCode"),
  })

  if (!parsedInput.success) {
    return buildError("Review the expense fields and try again.")
  }

  const canManageSessions = canManageTeamSessions({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })
  const canManageFinance = canManageTeamFinance({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })
  const adminSupabase = createAdminSupabaseClient()
  const { data: existingExpense, error: existingExpenseError } = await adminSupabase
    .from("team_expenses")
    .select(
      "id,team_id,team_venue_id,camp_id,created_by_profile_id,assigned_to_profile_id,receipt_bucket,receipt_storage_path,receipt_thumbnail_bucket,receipt_thumbnail_storage_path",
    )
    .eq("id", parsedInput.data.expenseId)
    .eq("team_id", scope.scopeTeamId)
    .maybeSingle()

  if (existingExpenseError || !existingExpense) {
    return buildError("Expense not found.")
  }

  const existing = existingExpense as TeamExpenseRow

  if (
    !canMutateTeamExpense({
      actorProfileId,
      assignedToProfileId: existing.assigned_to_profile_id,
      canManageTeamFinance: canManageFinance,
      canManageTeamSessions: canManageSessions,
    })
  ) {
    return buildError("You do not have permission to edit this expense.")
  }

  const assignedProfileResult = await resolveAssignedExpenseProfileId({
    actorProfileId,
    assignedToProfileId: parsedInput.data.assignedToProfileId,
    canManageTeamFinance: canManageFinance,
    teamId: scope.scopeTeamId,
  })

  if ("error" in assignedProfileResult) {
    return buildError(assignedProfileResult.error)
  }

  if (
    !canMutateTeamExpense({
      actorProfileId,
      assignedToProfileId: assignedProfileResult.assignedToProfileId,
      canManageTeamFinance: canManageFinance,
      canManageTeamSessions: canManageSessions,
    })
  ) {
    return buildError("You do not have permission to assign this expense.")
  }

  let scopedContext: Awaited<ReturnType<typeof loadScopedExpenseContext>>

  try {
    scopedContext = await loadScopedExpenseContext({
      organizationId: scope.scopeOrgId,
      teamId: scope.scopeTeamId,
      teamVenueId: parsedInput.data.teamVenueId,
    })
  } catch {
    return buildError("The selected venue is outside the active team scope.")
  }

  const supabase = await createServerSupabaseClient()
  let rateSnapshot: Awaited<ReturnType<typeof resolveExpenseRateSnapshot>>

  try {
    rateSnapshot = await resolveExpenseRateSnapshot({
      amountLocal: parsedInput.data.amountLocal,
      currencyCode: parsedInput.data.currencyCode,
      expenseDate: parsedInput.data.expenseDate,
      organizationCurrencyCode: scopedContext.organizationCurrencyCode,
      supabase,
    })
  } catch {
    return buildError("Could not resolve the exchange rate for this expense.")
  }

  const receiptFile = getFormFile(formData, "receiptFile")
  const thumbnailFile = getFormFile(formData, "receiptThumbnailFile")
  let receiptMetadata: ReceiptUploadMetadata | null = null
  let uploadedReceiptPaths: string[] = []
  const oldReceiptPaths = [
    existing.receipt_storage_path,
    existing.receipt_thumbnail_storage_path,
  ].filter((value): value is string => Boolean(value))

  if (receiptFile || thumbnailFile) {
    if (!receiptFile || !thumbnailFile) {
      return buildError("Select a receipt image before saving.")
    }

    const uploadResult = await uploadReceiptFiles({
      expenseId: parsedInput.data.expenseId,
      receiptFile,
      thumbnailFile,
      teamId: scope.scopeTeamId,
    })

    if ("error" in uploadResult) {
      return buildError(uploadResult.error)
    }

    receiptMetadata = uploadResult.metadata
    uploadedReceiptPaths = uploadResult.uploadedPaths
  }

  const { error: updateError } = await adminSupabase
    .from("team_expenses")
    .update({
      team_venue_id: parsedInput.data.teamVenueId,
      camp_id: null,
      assigned_to_profile_id: assignedProfileResult.assignedToProfileId,
      expense_date: parsedInput.data.expenseDate,
      vendor: parsedInput.data.vendor,
      expense_type: parsedInput.data.expenseType,
      description: normalizeOptionalText(parsedInput.data.description),
      amount_local: parsedInput.data.amountLocal,
      currency_code: parsedInput.data.currencyCode,
      organization_currency_code: rateSnapshot.organizationCurrencyCode,
      exchange_rate: rateSnapshot.exchangeRate,
      exchange_rate_date: rateSnapshot.exchangeRateDate,
      exchange_rate_source: rateSnapshot.exchangeRateSource,
      amount_organization_currency: rateSnapshot.amountOrganizationCurrency,
      ...(receiptMetadata ?? {}),
    })
    .eq("id", parsedInput.data.expenseId)
    .eq("team_id", scope.scopeTeamId)

  if (updateError) {
    await removeReceiptPaths(uploadedReceiptPaths)
    return buildError("Could not update expense. Confirm permissions and try again.")
  }

  if (receiptMetadata) {
    await removeReceiptPaths(oldReceiptPaths)
  }

  revalidateExpenseSurfaces(parsedInput.data.teamVenueId)

  return {
    ok: true,
    message: "Expense updated.",
  }
}

export async function deleteTeamExpenseAction(
  formData: FormData,
): Promise<ExpenseMutationResult> {
  const context = await requireAuthenticatedAccessContext()
  const scope = getScopeFromFormData(formData)
  const actorProfileId = context.profile?.id ?? context.user.id
  const parsedInput = deleteTeamExpenseInputSchema.safeParse({
    expenseId: getFormString(formData, "expenseId"),
  })

  if (!parsedInput.success || !scope.scopeOrgId || !scope.scopeTeamId) {
    return buildError("Invalid expense delete request.")
  }

  const canManageSessions = canManageTeamSessions({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })
  const canManageFinance = canManageTeamFinance({
    context,
    organizationId: scope.scopeOrgId,
    teamId: scope.scopeTeamId,
  })
  const adminSupabase = createAdminSupabaseClient()
  const { data: existingExpense, error: existingExpenseError } = await adminSupabase
    .from("team_expenses")
    .select(
      "id,team_id,team_venue_id,camp_id,created_by_profile_id,assigned_to_profile_id,receipt_bucket,receipt_storage_path,receipt_thumbnail_bucket,receipt_thumbnail_storage_path",
    )
    .eq("id", parsedInput.data.expenseId)
    .eq("team_id", scope.scopeTeamId)
    .maybeSingle()

  if (existingExpenseError || !existingExpense) {
    return buildError("Expense not found.")
  }

  const existing = existingExpense as TeamExpenseRow

  if (
    !canMutateTeamExpense({
      actorProfileId,
      assignedToProfileId: existing.assigned_to_profile_id,
      canManageTeamFinance: canManageFinance,
      canManageTeamSessions: canManageSessions,
    })
  ) {
    return buildError("You do not have permission to delete this expense.")
  }

  const { error: deleteError } = await adminSupabase
    .from("team_expenses")
    .delete()
    .eq("id", parsedInput.data.expenseId)
    .eq("team_id", scope.scopeTeamId)

  if (deleteError) {
    return buildError("Could not delete expense. Confirm permissions and try again.")
  }

  await removeReceiptPaths(
    [existing.receipt_storage_path, existing.receipt_thumbnail_storage_path].filter(
      (value): value is string => Boolean(value),
    ),
  )
  revalidateExpenseSurfaces(existing.team_venue_id)

  return {
    ok: true,
    message: "Expense deleted.",
  }
}
