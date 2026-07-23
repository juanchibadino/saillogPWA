function compareLatestUsageThenName(left, right) {
  const leftTime = Date.parse(left.latestSessionUsageAt)
  const rightTime = Date.parse(right.latestSessionUsageAt)
  const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime
  const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime

  if (normalizedLeftTime !== normalizedRightTime) {
    return normalizedRightTime - normalizedLeftTime
  }

  return left.name.localeCompare(right.name)
}

export function buildStandardMoveCampUsage(input) {
  const sessionsById = new Map(input.sessionRows.map((session) => [session.id, session]))
  const campsById = new Map(input.campRows.map((camp) => [camp.id, camp]))
  const usageRows = input.usageRows.filter(
    (usage) => usage.team_standard_move_id === input.standardMoveId,
  )
  const campUsageById = new Map()

  usageRows.forEach((usage) => {
    const session = sessionsById.get(usage.session_id)

    if (!session) {
      return
    }

    const camp = campsById.get(session.camp_id)

    if (!camp) {
      return
    }

    const current = campUsageById.get(camp.id)

    if (!current) {
      campUsageById.set(camp.id, {
        id: camp.id,
        latestSessionUsageAt: session.session_date,
        name: camp.name,
        usageCount: 1,
      })
      return
    }

    const currentTime = Date.parse(current.latestSessionUsageAt)
    const sessionTime = Date.parse(session.session_date)

    campUsageById.set(camp.id, {
      ...current,
      latestSessionUsageAt:
        Number.isNaN(sessionTime) || (!Number.isNaN(currentTime) && currentTime >= sessionTime)
          ? current.latestSessionUsageAt
          : session.session_date,
      usageCount: current.usageCount + 1,
    })
  })

  const camps = [...campUsageById.values()]
    .sort(compareLatestUsageThenName)
    .map((campUsage) => ({
      id: campUsage.id,
      name: campUsage.name,
      usageCount: campUsage.usageCount,
    }))

  return {
    itemId: input.standardMoveId,
    usageCount: usageRows.length,
    camps,
  }
}
