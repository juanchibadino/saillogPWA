import { z } from "zod";
import {
  ASSEMBLY_MODES,
  BASTIDOR_VARIANTS,
  type MatchedProfile,
} from "@/types/domain";
import { COLOR_GROUPS, isWoodType, STYLE_CODES } from "@/lib/catalog/taxonomy";
import { normalizeWoodType } from "@/lib/matching/exact-profile-match";

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function ensureBastidorCompatible(frame: MatchedProfile, label: string) {
  if (!frame.supportsBastidor) {
    throw new Error(`${label} no esta habilitada para bastidor.`);
  }
}

export const leadItemSchema = z
  .object({
    widthCm: z.number().positive(),
    heightCm: z.number().positive(),
    quantity: z.number().int().positive().max(100),
    woodType: z.string().trim().min(1),
    styleType: z.enum(STYLE_CODES),
    colorGroup: z.enum(COLOR_GROUPS),
    faceMm: z.number().positive(),
    depthMm: z.number().positive(),
    hasGlass: z.boolean(),
    hasMatboard: z.boolean(),
    matboardBorderCm: z.number().positive().nullable().optional(),
    finishColorHex: z.string().trim().nullable().optional(),
    finishColorName: z.string().trim().max(120).nullable().optional(),
    glassTypeId: z.string().uuid().nullable().optional(),
    matboardTypeId: z.string().uuid().nullable().optional(),
    uploadedImageUrl: z.string().url().nullable().optional(),
    renderUrl: z.string().url().nullable().optional(),
    assemblyMode: z.enum(ASSEMBLY_MODES).default("normal"),
    bastidorVariant: z.enum(BASTIDOR_VARIANTS).nullable().optional(),
    bastidorLightCm: z.number().positive().nullable().optional(),
    bastidorSecondaryFrameId: z.string().uuid().nullable().optional(),
    bastidorSupportMm: z.number().positive().nullable().optional(),
    bastidorLomoMm: z.number().positive().nullable().optional(),
    bastidorDepthMm: z.number().positive().nullable().optional(),
  })
  .superRefine((item, context) => {
    if (item.hasMatboard) {
      if (item.matboardBorderCm === null || item.matboardBorderCm === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["matboardBorderCm"],
          message: "matboardBorderCm es obligatorio cuando hasMatboard es true.",
        });
      }
    } else if (item.matboardBorderCm !== null && item.matboardBorderCm !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matboardBorderCm"],
        message: "matboardBorderCm debe ser null/omitido cuando hasMatboard es false.",
      });
    }

    const normalizedWood = normalizeWoodType(item.woodType);

    if (!isWoodType(normalizedWood)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["woodType"],
        message: "woodType invalido. Permitidos: pino, marupa, kiri, tiza.",
      });
    }

    if (item.colorGroup === "color") {
      if (!item.finishColorHex || !HEX_COLOR_REGEX.test(item.finishColorHex)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["finishColorHex"],
          message:
            "finishColorHex es obligatorio y debe tener formato HEX cuando colorGroup es color.",
        });
      }
    } else if (item.finishColorHex || item.finishColorName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finishColorHex"],
        message:
          "finishColorHex/finishColorName solo se permiten cuando colorGroup es color.",
      });
    }

    if (item.assemblyMode === "normal") {
      if (
        (item.bastidorVariant !== null && item.bastidorVariant !== undefined) ||
        (item.bastidorLightCm !== null && item.bastidorLightCm !== undefined) ||
        (item.bastidorSecondaryFrameId !== null && item.bastidorSecondaryFrameId !== undefined) ||
        (item.bastidorSupportMm !== null && item.bastidorSupportMm !== undefined) ||
        (item.bastidorLomoMm !== null && item.bastidorLomoMm !== undefined) ||
        (item.bastidorDepthMm !== null && item.bastidorDepthMm !== undefined)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assemblyMode"],
          message: "Los campos bastidor solo se permiten cuando assemblyMode es bastidor.",
        });
      }

      return;
    }

    if (!item.bastidorVariant) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bastidorVariant"],
        message: "bastidorVariant es obligatorio cuando assemblyMode es bastidor.",
      });
    }

    if (item.bastidorLightCm === null || item.bastidorLightCm === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bastidorLightCm"],
        message: "bastidorLightCm es obligatorio cuando assemblyMode es bastidor.",
      });
    }

    if (item.bastidorVariant === "simple") {
      if (
        (item.bastidorSecondaryFrameId !== null && item.bastidorSecondaryFrameId !== undefined) ||
        (item.bastidorSupportMm !== null && item.bastidorSupportMm !== undefined) ||
        (item.bastidorLomoMm !== null && item.bastidorLomoMm !== undefined) ||
        (item.bastidorDepthMm !== null && item.bastidorDepthMm !== undefined)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bastidorVariant"],
          message:
            "En bastidor simple el snapshot se deriva del perfil principal y no acepta campos manuales.",
        });
      }
    }

    if (item.bastidorVariant === "double_profile" && !item.bastidorSecondaryFrameId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bastidorSecondaryFrameId"],
        message: "Selecciona la segunda varilla para bastidor de dos varillas.",
      });
    }
  });
