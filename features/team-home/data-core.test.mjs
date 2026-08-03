import assert from "node:assert/strict"
import test from "node:test"

import { buildLatestTeamHomeVenueItems } from "./data-core.mjs"

const today = new Date("2026-08-02T12:00:00.000Z")

function buildTeamVenue(input) {
  return {
    created_at: input.linkedAt,
    id: input.id,
    team_id: "team-1",
    venue_id: input.venueId,
  }
}

function buildVenue(input) {
  return {
    city: input.city,
    country: input.country,
    id: input.id,
    name: input.name,
  }
}

function buildCamp(input) {
  return {
    created_at: input.createdAt,
    end_date: input.endDate,
    id: input.id,
    is_active: input.isActive,
    name: input.name,
    start_date: input.startDate,
    team_venue_id: input.teamVenueId,
  }
}

test("sorts a current camp venue above newer linked venues", () => {
  const items = buildLatestTeamHomeVenueItems({
    camps: [
      buildCamp({
        createdAt: "2026-07-01T10:00:00.000Z",
        endDate: "2026-08-05",
        id: "camp-current",
        isActive: true,
        name: "Current Camp",
        startDate: "2026-08-01",
        teamVenueId: "team-venue-current",
      }),
    ],
    limit: 5,
    teamVenues: [
      buildTeamVenue({
        id: "team-venue-current",
        linkedAt: "2026-07-01T00:00:00.000Z",
        venueId: "venue-current",
      }),
      buildTeamVenue({
        id: "team-venue-new-link",
        linkedAt: "2026-08-02T00:00:00.000Z",
        venueId: "venue-new-link",
      }),
    ],
    today,
    venues: [
      buildVenue({
        city: "Long Beach",
        country: "United States",
        id: "venue-current",
        name: "LA",
      }),
      buildVenue({
        city: "Kiel",
        country: "Germany",
        id: "venue-new-link",
        name: "Kiel",
      }),
    ],
  })

  assert.equal(items[0].teamVenueId, "team-venue-current")
  assert.equal(items[0].isCurrentCampVenue, true)
  assert.equal(items[0].latestCampId, "camp-current")
})

test("uses the best latest camp when a venue has multiple camps", () => {
  const items = buildLatestTeamHomeVenueItems({
    camps: [
      buildCamp({
        createdAt: "2025-07-01T10:00:00.000Z",
        endDate: "2025-07-05",
        id: "camp-previous-year",
        isActive: false,
        name: "Previous Year Camp",
        startDate: "2025-07-01",
        teamVenueId: "team-venue-la",
      }),
      buildCamp({
        createdAt: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-05",
        id: "camp-older",
        isActive: true,
        name: "Older Camp",
        startDate: "2026-06-01",
        teamVenueId: "team-venue-la",
      }),
      buildCamp({
        createdAt: "2026-07-01T10:00:00.000Z",
        endDate: "2026-07-05",
        id: "camp-latest",
        isActive: true,
        name: "Latest Camp",
        startDate: "2026-07-01",
        teamVenueId: "team-venue-la",
      }),
    ],
    limit: 5,
    teamVenues: [
      buildTeamVenue({
        id: "team-venue-la",
        linkedAt: "2026-05-01T00:00:00.000Z",
        venueId: "venue-la",
      }),
    ],
    today,
    venues: [
      buildVenue({
        city: "Long Beach",
        country: "United States",
        id: "venue-la",
        name: "LA",
      }),
    ],
  })

  assert.equal(items[0].latestCampId, "camp-latest")
  assert.equal(items[0].latestCampName, "Latest Camp")
  assert.equal(items[0].latestCampStartDate, "2026-07-01")
  assert.equal(items[0].latestCampEndDate, "2026-07-05")
  assert.equal(items[0].campDateRangeStart, "2026-06-01")
  assert.equal(items[0].campDateRangeEnd, "2026-07-05")
})

test("sorts venues without camps after camp venues by linked date", () => {
  const items = buildLatestTeamHomeVenueItems({
    camps: [
      buildCamp({
        createdAt: "2026-05-01T10:00:00.000Z",
        endDate: "2026-05-05",
        id: "camp-linked",
        isActive: false,
        name: "Past Camp",
        startDate: "2026-05-01",
        teamVenueId: "team-venue-with-camp",
      }),
    ],
    limit: 5,
    teamVenues: [
      buildTeamVenue({
        id: "team-venue-new-no-camp",
        linkedAt: "2026-08-05T00:00:00.000Z",
        venueId: "venue-new-no-camp",
      }),
      buildTeamVenue({
        id: "team-venue-old-no-camp",
        linkedAt: "2026-08-04T00:00:00.000Z",
        venueId: "venue-old-no-camp",
      }),
      buildTeamVenue({
        id: "team-venue-with-camp",
        linkedAt: "2026-01-01T00:00:00.000Z",
        venueId: "venue-with-camp",
      }),
    ],
    today,
    venues: [
      buildVenue({
        city: "Quiberon",
        country: "France",
        id: "venue-new-no-camp",
        name: "Quiberon",
      }),
      buildVenue({
        city: "Eckernforde",
        country: "Germany",
        id: "venue-old-no-camp",
        name: "Eckernforde",
      }),
      buildVenue({
        city: "Kiel",
        country: "Germany",
        id: "venue-with-camp",
        name: "Kiel",
      }),
    ],
  })

  assert.deepEqual(
    items.map((item) => item.teamVenueId),
    [
      "team-venue-with-camp",
      "team-venue-new-no-camp",
      "team-venue-old-no-camp",
    ],
  )
  assert.equal(items[1].latestCampId, null)
})
