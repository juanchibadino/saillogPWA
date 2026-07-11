const DAY_MS = 24 * 60 * 60 * 1000

function parseDateKey(value) {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addCalendarDays(dateKey, amount) {
  const date = parseDateKey(dateKey)

  if (!date) {
    return dateKey
  }

  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function getCalendarDayDistance(leftDateKey, rightDateKey) {
  const left = parseDateKey(leftDateKey)
  const right = parseDateKey(rightDateKey)

  if (!left || !right) {
    return 0
  }

  return Math.round((right.getTime() - left.getTime()) / DAY_MS)
}

function enumerateDateRange(startDate, endDate) {
  if (endDate < startDate) {
    return []
  }

  const dates = []
  let currentDate = startDate

  while (currentDate <= endDate) {
    dates.push(currentDate)
    currentDate = addCalendarDays(currentDate, 1)
  }

  return dates
}

function getSourceValue(source) {
  return `${source.sourceType}:${source.id}`
}

function getPresenceIds(input) {
  const sourcePresence = input.presenceBySourceDate?.[input.sourceValue]
  const datePresence = sourcePresence?.[input.date]
  return Array.isArray(datePresence) ? [...datePresence] : []
}

function buildDateRows(input) {
  const startDate =
    input.timeFilter === "all" ? `${input.today.slice(0, 4)}-01-01` : input.today
  const rows = []

  for (const source of input.sources) {
    const sourceValue = getSourceValue(source)

    if (input.selectedEventFilter && input.selectedEventFilter.value !== sourceValue) {
      continue
    }

    for (const date of enumerateDateRange(source.startDate, source.endDate)) {
      if (date < startDate) {
        continue
      }

      const presentProfileIds = getPresenceIds({
        date,
        presenceBySourceDate: input.presenceBySourceDate,
        sourceValue,
      })

      rows.push({
        type: "day",
        timelineId: `day:${sourceValue}:${date}`,
        date,
        sourceType: source.sourceType,
        sourceId: source.id,
        sourceValue,
        title: source.title,
        eventType: source.eventType ?? null,
        startDate: source.startDate,
        endDate: source.endDate,
        venueName: source.venueName ?? null,
        notes: source.notes ?? null,
        isFirstDay: date === source.startDate,
        isLastDay: date === source.endDate,
        presentProfileIds,
        targetProfileId: input.targetProfileId ?? null,
        isTargetPresent: input.targetProfileId
          ? presentProfileIds.includes(input.targetProfileId)
          : false,
      })
    }
  }

  return rows
}

function sortDayRows(left, right) {
  const dateDiff = left.date.localeCompare(right.date)

  if (dateDiff !== 0) {
    return dateDiff
  }

  const sourceDiff = left.sourceType.localeCompare(right.sourceType)

  if (sourceDiff !== 0) {
    return sourceDiff
  }

  return left.title.localeCompare(right.title)
}

function buildGapRow(startDate, endDate) {
  return {
    type: "gap",
    timelineId: `gap:${startDate}:${endDate}`,
    startDate,
    endDate,
  }
}

function buildTimelineWithFutureGaps(rows, today) {
  if (rows.length === 0) {
    return []
  }

  const timeline = []
  let previousDate = null

  for (const row of rows) {
    if (!previousDate) {
      if (getCalendarDayDistance(today, row.date) > 0) {
        timeline.push(buildGapRow(today, addCalendarDays(row.date, -1)))
      }
    } else if (getCalendarDayDistance(previousDate, row.date) > 1) {
      timeline.push(buildGapRow(addCalendarDays(previousDate, 1), addCalendarDays(row.date, -1)))
    }

    timeline.push(row)
    previousDate = row.date
  }

  return timeline
}

export function buildTeamCalendarTimeline(input) {
  const timeFilter = input.timeFilter === "all" ? "all" : "future"
  const today = input.today
  const startDate = timeFilter === "all" ? `${today.slice(0, 4)}-01-01` : today
  const rows = buildDateRows({
    sources: input.sources ?? [],
    today,
    timeFilter,
    selectedEventFilter: input.selectedEventFilter,
    targetProfileId: input.targetProfileId,
    presenceBySourceDate: input.presenceBySourceDate,
  }).sort(sortDayRows)

  return buildTimelineWithFutureGaps(rows, startDate)
}
