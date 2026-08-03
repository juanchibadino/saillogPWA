function toUtcDayValue(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function parseDateOnlyValue(value) {
  const date = new Date(`${value}T00:00:00.000Z`)

  return Number.isNaN(date.getTime())
    ? Number.NEGATIVE_INFINITY
    : toUtcDayValue(date)
}

function parseTimestampValue(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? Number.NEGATIVE_INFINITY
    : date.getTime()
}

function compareDescending(left, right) {
  if (left === right) {
    return 0
  }

  return right - left
}

function isCampCurrent(camp, today) {
  const start = parseDateOnlyValue(camp.start_date)
  const end = parseDateOnlyValue(camp.end_date)

  if (
    start === Number.NEGATIVE_INFINITY ||
    end === Number.NEGATIVE_INFINITY
  ) {
    return false
  }

  const todayValue = toUtcDayValue(today)

  return todayValue >= start && todayValue <= end
}

function buildCampRank(camp, today) {
  return {
    createdAt: parseTimestampValue(camp.created_at),
    isActive: camp.is_active === true,
    isCurrent: isCampCurrent(camp, today),
    startDate: parseDateOnlyValue(camp.start_date),
  }
}

function compareCampRanks(left, right) {
  return (
    compareDescending(Number(left.isCurrent), Number(right.isCurrent)) ||
    compareDescending(Number(left.isActive), Number(right.isActive)) ||
    compareDescending(left.startDate, right.startDate) ||
    compareDescending(left.createdAt, right.createdAt)
  )
}

function getBestCamp(camps, today) {
  const rankedCamps = camps
    .map((camp) => ({
      camp,
      rank: buildCampRank(camp, today),
    }))
    .sort((left, right) => compareCampRanks(left.rank, right.rank))

  return rankedCamps[0]?.camp ?? null
}

function getCampDateRange(camps, referenceCamp) {
  const referenceYear = referenceCamp
    ? new Date(`${referenceCamp.start_date}T00:00:00.000Z`).getUTCFullYear()
    : null
  const rangeCamps = referenceYear
    ? camps.filter((camp) => {
        const date = new Date(`${camp.start_date}T00:00:00.000Z`)

        return !Number.isNaN(date.getTime()) && date.getUTCFullYear() === referenceYear
      })
    : camps
  let firstStartDate = null
  let firstStartValue = Number.POSITIVE_INFINITY
  let lastEndDate = null
  let lastEndValue = Number.NEGATIVE_INFINITY

  for (const camp of rangeCamps) {
    const startValue = parseDateOnlyValue(camp.start_date)
    const endValue = parseDateOnlyValue(camp.end_date)

    if (startValue < firstStartValue) {
      firstStartDate = camp.start_date
      firstStartValue = startValue
    }

    if (endValue > lastEndValue) {
      lastEndDate = camp.end_date
      lastEndValue = endValue
    }
  }

  if (!firstStartDate || !lastEndDate) {
    return null
  }

  return {
    endDate: lastEndDate,
    startDate: firstStartDate,
  }
}

function buildVenueRank(input) {
  return {
    campCreatedAt: input.camp
      ? parseTimestampValue(input.camp.created_at)
      : Number.NEGATIVE_INFINITY,
    isActiveCamp: input.camp?.is_active === true,
    isCurrentCamp: input.isCurrentCampVenue,
    linkedAt: parseTimestampValue(input.teamVenue.created_at),
    startDate: input.camp
      ? parseDateOnlyValue(input.camp.start_date)
      : Number.NEGATIVE_INFINITY,
  }
}

function compareVenueRanks(left, right) {
  return (
    compareDescending(Number(left.isCurrentCamp), Number(right.isCurrentCamp)) ||
    compareDescending(Number(left.isActiveCamp), Number(right.isActiveCamp)) ||
    compareDescending(left.startDate, right.startDate) ||
    compareDescending(left.campCreatedAt, right.campCreatedAt) ||
    compareDescending(left.linkedAt, right.linkedAt)
  )
}

function normalizeLimit(limit) {
  if (!Number.isFinite(limit)) {
    return 5
  }

  return Math.max(0, Math.floor(limit))
}

export function buildLatestTeamHomeVenueItems(input) {
  const limit = normalizeLimit(input.limit ?? 5)
  const today = input.today ?? new Date()
  const venueById = new Map(input.venues.map((venue) => [venue.id, venue]))
  const campsByTeamVenueId = new Map()

  for (const camp of input.camps) {
    const camps = campsByTeamVenueId.get(camp.team_venue_id) ?? []
    camps.push(camp)
    campsByTeamVenueId.set(camp.team_venue_id, camps)
  }

  return input.teamVenues
    .map((teamVenue) => {
      const venue = venueById.get(teamVenue.venue_id)

      if (!venue) {
        return null
      }

      const venueCamps = campsByTeamVenueId.get(teamVenue.id) ?? []
      const camp = getBestCamp(venueCamps, today)
      const campDateRange = getCampDateRange(venueCamps, camp)
      const isCurrentCampVenue = camp ? isCampCurrent(camp, today) : false

      return {
        item: {
          campDateRangeEnd: campDateRange?.endDate ?? null,
          campDateRangeStart: campDateRange?.startDate ?? null,
          isCurrentCampVenue,
          latestCampEndDate: camp?.end_date ?? null,
          latestCampId: camp?.id ?? null,
          latestCampName: camp?.name ?? null,
          latestCampStartDate: camp?.start_date ?? null,
          linkedAt: teamVenue.created_at,
          location: `${venue.city}, ${venue.country}`,
          name: venue.name,
          teamVenueId: teamVenue.id,
          venueId: venue.id,
        },
        rank: buildVenueRank({
          camp,
          isCurrentCampVenue,
          teamVenue,
        }),
      }
    })
    .filter((row) => row !== null)
    .sort((left, right) => {
      const rankOrder = compareVenueRanks(left.rank, right.rank)

      if (rankOrder !== 0) {
        return rankOrder
      }

      return (
        left.item.name.localeCompare(right.item.name) ||
        left.item.teamVenueId.localeCompare(right.item.teamVenueId)
      )
    })
    .slice(0, limit)
    .map((row) => row.item)
}
