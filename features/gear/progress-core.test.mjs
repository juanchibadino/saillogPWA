import assert from "node:assert/strict"
import test from "node:test"

import {
  buildGearProgressModel,
  getGearProgressIndicatorClassName,
} from "./progress-core.mjs"

function buildGearItem(overrides = {}) {
  return {
    alertRules: [
      {
        id: "near-limit-minutes",
        metric: "usage_minutes",
        severity: "critical",
        thresholdValue: 80,
      },
      {
        id: "past-due-minutes",
        metric: "usage_minutes",
        severity: "warning",
        thresholdValue: 100,
      },
    ],
    alertState: "none",
    usageCount: 0,
    usageMinutes: 0,
    ...overrides,
  }
}

test("uses the Past Due threshold as the progress max", () => {
  const model = buildGearProgressModel(
    buildGearItem({
      alertState: "critical",
      usageMinutes: 90,
    }),
  )

  assert.equal(model.rule.id, "past-due-minutes")
  assert.equal(model.thresholdValue, 100)
  assert.equal(model.rawPercent, 90)
  assert.equal(model.visualPercent, 90)
  assert.equal(model.indicatorClassName, "bg-amber-400")
})

test("caps visible progress at 100 percent after Past Due", () => {
  const model = buildGearProgressModel(
    buildGearItem({
      alertState: "warning",
      usageMinutes: 125,
    }),
  )

  assert.equal(model.rawPercent, 125)
  assert.equal(model.visualPercent, 100)
  assert.equal(model.indicatorClassName, "bg-red-500")
})

test("falls back to OK progress without a Past Due threshold", () => {
  const model = buildGearProgressModel(
    buildGearItem({
      alertRules: [
        {
          id: "near-limit-only",
          metric: "usage_minutes",
          severity: "critical",
          thresholdValue: 80,
        },
      ],
      usageMinutes: 90,
    }),
  )

  assert.equal(model.rule, null)
  assert.equal(model.thresholdValue, 0)
  assert.equal(model.rawPercent, 0)
  assert.equal(model.visualPercent, 0)
})

test("maps alert states to Gear progress colors", () => {
  assert.equal(getGearProgressIndicatorClassName("none"), "bg-emerald-500")
  assert.equal(getGearProgressIndicatorClassName("critical"), "bg-amber-400")
  assert.equal(getGearProgressIndicatorClassName("warning"), "bg-red-500")
})
