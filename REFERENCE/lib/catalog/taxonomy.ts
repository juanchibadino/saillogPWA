export const STYLE_CODES = [
  "chata",
  "curva",
  "l_recta",
  "l_bombe",
  "chanfle",
  "batea",
  "francesa",
  "italiana",
] as const;

export const WOOD_TYPES = ["pino", "marupa", "kiri", "tiza"] as const;

export const COLOR_GROUPS = ["natural", "blanca", "negra", "color"] as const;

export type StyleType = (typeof STYLE_CODES)[number];
export type WoodType = (typeof WOOD_TYPES)[number];
export type ColorGroup = (typeof COLOR_GROUPS)[number];

export const STYLE_LABELS: Record<StyleType, string> = {
  chata: "Chato",
  curva: "Bombé/Curvo",
  l_recta: "L Recta",
  l_bombe: "L Bombé",
  chanfle: "Chanfle",
  batea: "Batea",
  francesa: "Francesa",
  italiana: "Italiana",
};

export const WOOD_LABELS: Record<WoodType, string> = {
  pino: "Pino",
  marupa: "Marupá",
  kiri: "Kiri",
  tiza: "Tiza",
};

export const COLOR_GROUP_LABELS: Record<ColorGroup, string> = {
  natural: "Natural",
  blanca: "Blanco",
  negra: "Negro",
  color: "Color",
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}

export function isStyleType(value: string): value is StyleType {
  return (STYLE_CODES as readonly string[]).includes(value);
}

export function isWoodType(value: string): value is WoodType {
  return (WOOD_TYPES as readonly string[]).includes(value);
}

export function isColorGroup(value: string): value is ColorGroup {
  return (COLOR_GROUPS as readonly string[]).includes(value);
}

export function normalizeWoodType(raw: string): string {
  const normalized = normalizeText(raw);
  return normalized === "marupa" ? "marupa" : normalized;
}

export function normalizeStyleType(raw: string): StyleType | null {
  const normalized = normalizeText(raw);

  if (normalized === "chata" || normalized === "chato") {
    return "chata";
  }

  if (
    normalized === "curva" ||
    normalized === "curvo" ||
    normalized === "bombe" ||
    normalized === "bombe_curvo" ||
    normalized === "bombe_o_curvo"
  ) {
    return "curva";
  }

  if (normalized === "l_recta") {
    return "l_recta";
  }

  if (normalized === "l_bombe") {
    return "l_bombe";
  }

  if (normalized === "chanfle") {
    return "chanfle";
  }

  if (normalized === "batea") {
    return "batea";
  }

  if (normalized === "francesa") {
    return "francesa";
  }

  if (normalized === "italiana") {
    return "italiana";
  }

  return null;
}

export function displayStyleLabel(style: string): string {
  return isStyleType(style)
    ? STYLE_LABELS[style]
    : style
      ? `${style.charAt(0).toUpperCase()}${style.slice(1)}`
      : style;
}

export function displayWoodLabel(wood: string): string {
  return isWoodType(wood)
    ? WOOD_LABELS[wood]
    : wood
      ? `${wood.charAt(0).toUpperCase()}${wood.slice(1)}`
      : wood;
}
