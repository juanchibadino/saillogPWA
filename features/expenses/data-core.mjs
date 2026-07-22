export const TEAM_EXPENSES_PAGE_SIZE = 25

export function resolveExpenseVisibilityScope(input) {
  if (input.forceTeamScope === true) {
    return "team"
  }

  if (input.requestedScope === "team" && input.teamTotalsEnabled === true) {
    return "team"
  }

  return "mine"
}

export function canCreateTeamExpense(input) {
  if (input.canManageTeamSessions !== true || !input.actorProfileId) {
    return false
  }

  if (input.actorProfileId === input.assignedToProfileId) {
    return true
  }

  return input.canManageTeamFinance === true
}

export function canMutateTeamExpense(input) {
  if (input.canManageTeamSessions !== true || !input.actorProfileId) {
    return false
  }

  if (input.actorProfileId === input.assignedToProfileId) {
    return true
  }

  return input.canManageTeamFinance === true
}

export function roundExpenseAmount(value) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateConvertedExpenseAmount(input) {
  return roundExpenseAmount(input.amountLocal * input.exchangeRate)
}

export function getPreviousCloseRateDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
