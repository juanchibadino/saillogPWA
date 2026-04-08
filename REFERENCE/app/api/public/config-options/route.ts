import { NextResponse } from "next/server";
import type { PublicConfigOptionsResponse } from "@/lib/catalog/public-options";
import {
  COLOR_GROUP_LABELS,
  STYLE_LABELS,
  WOOD_LABELS,
  isColorGroup,
  isStyleType,
  isWoodType,
} from "@/lib/catalog/taxonomy";
import { serverError } from "@/lib/http/responses";
import { createSupabaseAnonClient } from "@/lib/supabase/client";

type PublicFrameRow = {
  id: string;
  wood_type: string;
  style_type: string;
  color_group: string;
  face_mm: number | string;
  depth_mm: number | string;
  supports_bastidor?: boolean | null;
  lomo_mm?: number | string | null;
  public_label: string | null;
  sort_order: number | string;
};

function isMissingBastidorCatalogFrameColumnsError(error: {
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

export async function GET() {
  const supabase = createSupabaseAnonClient();

  const framesQuery = () =>
    supabase
      .from("catalog_frames")
      .select(
        "id, wood_type, style_type, color_group, face_mm, depth_mm, supports_bastidor, lomo_mm, public_label, sort_order",
      )
      .eq("active", true)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("style_type", { ascending: true })
      .order("face_mm", { ascending: true })
      .order("depth_mm", { ascending: true })
      .order("wood_type", { ascending: true })
      .order("color_group", { ascending: true });
  const legacyFramesQuery = () =>
    supabase
      .from("catalog_frames")
      .select("id, wood_type, style_type, color_group, face_mm, depth_mm, public_label, sort_order")
      .eq("active", true)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("style_type", { ascending: true })
      .order("face_mm", { ascending: true })
      .order("depth_mm", { ascending: true })
      .order("wood_type", { ascending: true })
      .order("color_group", { ascending: true });

  const [initialFramesResult, glassResult, matboardResult] = await Promise.all([
    framesQuery(),
    supabase
      .from("glass_types")
      .select("id, name")
      .eq("active", true)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("matboard_types")
      .select("id, name")
      .eq("active", true)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  let framesData = (initialFramesResult.data ?? null) as PublicFrameRow[] | null;
  let framesError = initialFramesResult.error;

  if (framesError && isMissingBastidorCatalogFrameColumnsError(framesError)) {
    const legacyFramesResult = await legacyFramesQuery();
    framesData = (legacyFramesResult.data ?? null) as PublicFrameRow[] | null;
    framesError = legacyFramesResult.error;
  }

  const errors = [framesError, glassResult.error, matboardResult.error].filter(Boolean);

  if (errors.length > 0) {
    return serverError(
      "Failed to load public configurator options.",
      errors.map((error) => error?.message),
    );
  }

  const payload: PublicConfigOptionsResponse = {
    frames: (framesData ?? []).map((row) => {
      const wood = row.wood_type;
      const style = row.style_type;
      const color = row.color_group;
      const face = Number(row.face_mm);
      const depth = Number(row.depth_mm);
      const safeStyle = isStyleType(style) ? style : "chata";
      const safeColor = isColorGroup(color) ? color : "natural";
      const woodLabel = isWoodType(wood) ? WOOD_LABELS[wood] : wood;
      const styleLabel = isStyleType(style) ? STYLE_LABELS[style] : style;
      const colorLabel = isColorGroup(color) ? COLOR_GROUP_LABELS[color] : color;

      return {
        id: row.id,
        woodType: wood,
        styleType: safeStyle,
        colorGroup: safeColor,
        faceMm: face,
        depthMm: depth,
        supportsBastidor: row.supports_bastidor === true,
        lomoMm:
          row.lomo_mm === null || row.lomo_mm === undefined
            ? null
            : Number(row.lomo_mm),
        sortOrder: Number(row.sort_order),
        label:
          row.public_label ??
          `${woodLabel} ${styleLabel} ${colorLabel} ${face.toFixed(0)}x${depth.toFixed(0)}`,
      };
    }),
    glassTypes: (glassResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
    })),
    matboardTypes: (matboardResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
    })),
  };

  return NextResponse.json(payload);
}
