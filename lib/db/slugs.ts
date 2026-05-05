import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

type DatabaseClient = SupabaseClient<Database>

type SlugRow = {
  slug: string
}

function slugifyText(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : fallback
}

function resolveAvailableSlug(baseSlug: string, existingSlugs: string[]): string {
  const slugSet = new Set(existingSlugs)

  if (!slugSet.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2

  while (slugSet.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

function filterMatchingSlugs(baseSlug: string, rows: SlugRow[]): string[] {
  const matcher = new RegExp(`^${baseSlug}(?:-(\\d+))?$`)

  return rows
    .map((row) => row.slug)
    .filter((slug) => matcher.test(slug))
}

export async function generateUniqueOrganizationSlug(input: {
  supabase: DatabaseClient
  name: string
}): Promise<string> {
  const baseSlug = slugifyText(input.name, "organization")
  const { data, error } = await input.supabase
    .from("organizations")
    .select("slug")
    .like("slug", `${baseSlug}%`)

  if (error) {
    throw new Error(`Could not load organization slugs: ${error.message}`)
  }

  const matchingSlugs = filterMatchingSlugs(baseSlug, (data ?? []) as SlugRow[])
  return resolveAvailableSlug(baseSlug, matchingSlugs)
}

export async function generateUniqueTeamSlug(input: {
  supabase: DatabaseClient
  organizationId: string
  name: string
}): Promise<string> {
  const baseSlug = slugifyText(input.name, "team")
  const { data, error } = await input.supabase
    .from("teams")
    .select("slug")
    .eq("organization_id", input.organizationId)
    .like("slug", `${baseSlug}%`)

  if (error) {
    throw new Error(`Could not load team slugs: ${error.message}`)
  }

  const matchingSlugs = filterMatchingSlugs(baseSlug, (data ?? []) as SlugRow[])
  return resolveAvailableSlug(baseSlug, matchingSlugs)
}
