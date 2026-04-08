import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWoodType as normalizeCatalogWoodType } from "@/lib/catalog/taxonomy";
import type { MatchedProfile, MatchingInput } from "@/types/domain";

type CatalogFrameMatchRow = {
  id: string;
  wood_type: string;
  style_type: MatchedProfile["styleType"];
  color_group: MatchedProfile["colorGroup"];
  face_mm: number | string;
  depth_mm: number | string;
  public_label: string | null;
  supports_bastidor?: boolean | null;
  lomo_mm?: number | string | null;
};

export class MissingExactProfileMatchError extends Error {
  constructor() {
    super("No active curated frame matched this exact selection.");
  }
}

export class AmbiguousExactProfileMatchError extends Error {
  constructor() {
    super("More than one active curated frame matched this exact selection.");
  }
}

export function normalizeWoodType(value: string): string {
  return normalizeCatalogWoodType(value);
}

export function buildExactMatchingKey(input: MatchingInput): string {
  return [
    normalizeWoodType(input.woodType),
    input.styleType,
    input.colorGroup,
    input.faceMm.toFixed(2),
    input.depthMm.toFixed(2),
  ].join("|");
}

export function isMissingBastidorCatalogFrameColumnsError(error: {
  code?: string | null;
  message?: string | null;
}) {
  if (!error.message) {
    return false;
  }

  if (error.code !== "PGRST204" && error.code !== "42703") {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("supports_bastidor") || message.includes("lomo_mm");
}

export async function resolveExactProfileBySelection(
  supabase: SupabaseClient,
  input: MatchingInput,
  onlyPublic: boolean,
): Promise<MatchedProfile> {
  const baseQuery = (columns: string) => {
    let query = supabase
      .from("catalog_frames")
      .select(columns)
      .eq("active", true)
      .eq("wood_type", normalizeWoodType(input.woodType))
      .eq("style_type", input.styleType)
      .eq("color_group", input.colorGroup)
      .eq("face_mm", input.faceMm)
      .eq("depth_mm", input.depthMm);

    if (onlyPublic) {
      query = query.eq("is_public", true);
    }

    return query;
  };

  let { data, error } = await baseQuery(
    "id, wood_type, style_type, color_group, face_mm, depth_mm, public_label, supports_bastidor, lomo_mm",
  );

  if (error && isMissingBastidorCatalogFrameColumnsError(error)) {
    ({ data, error } = await baseQuery(
      "id, wood_type, style_type, color_group, face_mm, depth_mm, public_label",
    ));
  }

  if (error) {
    throw new Error(`Curated frame matching query failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new MissingExactProfileMatchError();
  }

  if (data.length > 1) {
    throw new AmbiguousExactProfileMatchError();
  }

  const row = data[0] as unknown as CatalogFrameMatchRow;

  return {
    id: row.id,
    woodType: row.wood_type,
    styleType: row.style_type,
    colorGroup: row.color_group,
    faceMm: Number(row.face_mm),
    depthMm: Number(row.depth_mm),
    referencePricePerMeter: 0,
    referenceCostPerMeter: 0,
    publicLabel: row.public_label,
    supportsBastidor: row.supports_bastidor === true,
    lomoMm:
      row.lomo_mm === null || row.lomo_mm === undefined ? null : Number(row.lomo_mm),
  };
}
