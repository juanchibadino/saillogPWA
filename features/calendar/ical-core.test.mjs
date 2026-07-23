import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTeamCalendarEventUid,
  buildTeamCalendarIcs,
  escapeIcsText,
} from "./ical-core.mjs"

const CAMP = {
  id: "44444444-4444-4444-8444-444444444444",
  sourceType: "camp",
  title: "Palma Camp",
  eventType: "camp",
  startDate: "2026-08-01",
  endDate: "2026-08-07",
  venueName: "Palma, Mallorca",
  notes: "Bring sails; confirm rib\nDock 4",
  url: "https://dockout.app/team-calendar?org=org-1&team=team-1&event=camp%3A44444444-4444-4444-8444-444444444444",
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-02T12:00:00.000Z",
}

test("escapes iCalendar text values", () => {
  assert.equal(
    escapeIcsText("Palma, dock; line\\one\nline two"),
    "Palma\\, dock\\; line\\\\one\\nline two",
  )
})

test("builds stable event UIDs", () => {
  assert.equal(
    buildTeamCalendarEventUid(CAMP),
    "camp-44444444-4444-4444-8444-444444444444@dockout.app",
  )
})

test("serializes all-day date ranges with exclusive DTEND and mapped fields", () => {
  const ics = buildTeamCalendarIcs({
    calendarName: "America One Calendar",
    events: [CAMP],
    generatedAt: "2026-07-23T10:11:12.000Z",
  })

  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/)
  assert.match(ics, /X-WR-CALNAME:America One Calendar\r\n/)
  assert.match(ics, /UID:camp-44444444-4444-4444-8444-444444444444@dockout\.app\r\n/)
  assert.match(ics, /DTSTAMP:20260723T101112Z\r\n/)
  assert.match(ics, /CREATED:20260701T120000Z\r\n/)
  assert.match(ics, /LAST-MODIFIED:20260702T120000Z\r\n/)
  assert.match(ics, /DTSTART;VALUE=DATE:20260801\r\n/)
  assert.match(ics, /DTEND;VALUE=DATE:20260808\r\n/)
  assert.match(ics, /LOCATION:Palma\\, Mallorca\r\n/)
  assert.match(ics, /DESCRIPTION:Bring sails\\; confirm rib\\nDock 4\r\n/)
  assert.match(ics, /URL:https:\/\/dockout\.app\/team-calendar/)
  assert.match(ics, /END:VCALENDAR\r\n$/)
})
