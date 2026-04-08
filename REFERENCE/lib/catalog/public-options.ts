import type { ColorGroup, StyleType } from "@/lib/catalog/taxonomy";

export type PublicConfigOptionsResponse = {
  frames: Array<{
    id: string;
    woodType: string;
    styleType: StyleType;
    colorGroup: ColorGroup;
    faceMm: number;
    depthMm: number;
    supportsBastidor: boolean;
    lomoMm: number | null;
    label: string;
    sortOrder: number;
  }>;
  glassTypes: Array<{ id: string; name: string }>;
  matboardTypes: Array<{ id: string; name: string }>;
};

export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();

  for (const row of rows) {
    map.set(row.id, row);
  }

  return Array.from(map.values());
}
