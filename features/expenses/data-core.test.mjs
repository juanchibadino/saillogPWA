import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateConvertedExpenseAmount,
  canCreateTeamExpense,
  canMutateTeamExpense,
  getPreviousCloseRateDate,
  resolveExpenseVisibilityScope,
} from "./data-core.mjs"

test("resolves expense visibility scope from team setting", () => {
  assert.equal(
    resolveExpenseVisibilityScope({
      requestedScope: "team",
      teamTotalsEnabled: false,
    }),
    "mine",
  )
  assert.equal(
    resolveExpenseVisibilityScope({
      requestedScope: "team",
      teamTotalsEnabled: true,
    }),
    "team",
  )
  assert.equal(
    resolveExpenseVisibilityScope({
      requestedScope: "mine",
      teamTotalsEnabled: true,
    }),
    "mine",
  )
  assert.equal(
    resolveExpenseVisibilityScope({
      requestedScope: "mine",
      teamTotalsEnabled: false,
      forceTeamScope: true,
    }),
    "team",
  )
})

test("allows assigned member creation and restricts cross-member creation to finance managers", () => {
  assert.equal(
    canCreateTeamExpense({
      actorProfileId: "profile-1",
      assignedToProfileId: "profile-1",
      canManageTeamFinance: false,
      canManageTeamSessions: true,
    }),
    true,
  )
  assert.equal(
    canCreateTeamExpense({
      actorProfileId: "profile-1",
      assignedToProfileId: "profile-2",
      canManageTeamFinance: false,
      canManageTeamSessions: true,
    }),
    false,
  )
  assert.equal(
    canCreateTeamExpense({
      actorProfileId: "profile-1",
      assignedToProfileId: "profile-2",
      canManageTeamFinance: true,
      canManageTeamSessions: true,
    }),
    true,
  )
})

test("allows assigned member mutations and restricts cross-member mutations to finance managers", () => {
  assert.equal(
    canMutateTeamExpense({
      actorProfileId: "profile-1",
      assignedToProfileId: "profile-1",
      canManageTeamFinance: false,
      canManageTeamSessions: true,
    }),
    true,
  )
  assert.equal(
    canMutateTeamExpense({
      actorProfileId: "profile-1",
      assignedToProfileId: "profile-2",
      canManageTeamFinance: false,
      canManageTeamSessions: true,
    }),
    false,
  )
  assert.equal(
    canMutateTeamExpense({
      actorProfileId: "profile-1",
      assignedToProfileId: "profile-2",
      canManageTeamFinance: true,
      canManageTeamSessions: true,
    }),
    true,
  )
})

test("calculates converted expense amounts with currency rounding", () => {
  assert.equal(
    calculateConvertedExpenseAmount({
      amountLocal: 123.456,
      exchangeRate: 1.2345,
    }),
    152.41,
  )
})

test("uses previous-day close date for exchange-rate snapshots", () => {
  assert.equal(getPreviousCloseRateDate("2026-07-22"), "2026-07-21")
})
