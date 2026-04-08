import test from "node:test";
import assert from "node:assert/strict";
import { calculateLeadPreliminaryTotal } from "@/lib/pricing/lead-total";
import {
  ensureBastidorCompatible,
  leadItemSchema,
} from "@/lib/public-leads";
import type { MatchedProfile } from "@/types/domain";

test("calculateLeadPreliminaryTotal sums multiple items", () => {
  const total = calculateLeadPreliminaryTotal([
    { preliminaryPrice: 100.5 },
    { preliminaryPrice: 200.25 },
    { preliminaryPrice: 99.25 },
  ]);

  assert.equal(total, 400);
});

test("calculateLeadPreliminaryTotal handles decimal totals", () => {
  const total = calculateLeadPreliminaryTotal([
    { preliminaryPrice: 10.1 },
    { preliminaryPrice: 20.2 },
    { preliminaryPrice: 30.3 },
  ]);

  assert.ok(Math.abs(total - 60.6) < 1e-9);
});

function buildBaseLeadItem() {
  return {
    widthCm: 50,
    heightCm: 60,
    quantity: 1,
    woodType: "kiri",
    styleType: "chata" as const,
    colorGroup: "natural" as const,
    faceMm: 24,
    depthMm: 10,
    hasGlass: true,
    hasMatboard: false,
    glassTypeId: null,
    matboardTypeId: null,
    assemblyMode: "normal" as const,
  };
}

test("leadItemSchema accepts normal items without bastidor snapshot", () => {
  const parsed = leadItemSchema.safeParse(buildBaseLeadItem());

  assert.equal(parsed.success, true);
});

test("leadItemSchema accepts bastidor simple with luz only", () => {
  const parsed = leadItemSchema.safeParse({
    ...buildBaseLeadItem(),
    assemblyMode: "bastidor",
    bastidorVariant: "simple",
    bastidorLightCm: 1,
  });

  assert.equal(parsed.success, true);
});

test("leadItemSchema accepts bastidor de dos varillas with secondary frame only", () => {
  const parsed = leadItemSchema.safeParse({
    ...buildBaseLeadItem(),
    assemblyMode: "bastidor",
    bastidorVariant: "double_profile",
    bastidorLightCm: 1,
    bastidorSecondaryFrameId: "550e8400-e29b-41d4-a716-446655440000",
  });

  assert.equal(parsed.success, true);
});

test("leadItemSchema rejects bastidor de dos varillas without secondary frame", () => {
  const parsed = leadItemSchema.safeParse({
    ...buildBaseLeadItem(),
    assemblyMode: "bastidor",
    bastidorVariant: "double_profile",
    bastidorLightCm: 1,
  });

  assert.equal(parsed.success, false);
  assert.match(parsed.error.issues[0]?.message ?? "", /segunda varilla/i);
});

test("ensureBastidorCompatible rejects profiles not enabled for bastidor", () => {
  const frame: MatchedProfile = {
    id: "frame-1",
    woodType: "kiri",
    styleType: "chata",
    colorGroup: "natural",
    faceMm: 24,
    depthMm: 10,
    referencePricePerMeter: 0,
    referenceCostPerMeter: 0,
    publicLabel: "Chata 24x10",
    supportsBastidor: false,
    lomoMm: null,
  };

  assert.throws(
    () => ensureBastidorCompatible(frame, "La varilla principal"),
    /no esta habilitada para bastidor/i,
  );
});
