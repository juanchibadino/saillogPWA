function parseDateKey(value) {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function addCalendarDays(dateKey, amount) {
  const date = parseDateKey(dateKey)

  if (!date) {
    return dateKey
  }

  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function toIcsDate(dateKey) {
  return String(dateKey).replaceAll("-", "")
}

function toIcsDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return toIcsDateTime(new Date(0))
  }

  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

export function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}

function foldIcsLine(line) {
  const maxLength = 75

  if (line.length <= maxLength) {
    return line
  }

  const chunks = []
  let remaining = line

  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength))
    remaining = remaining.slice(maxLength)
  }

  chunks.push(remaining)
  return chunks.join("\r\n ")
}

function getEventTypeLabel(eventType) {
  if (eventType === "camp") {
    return "Camp"
  }

  if (eventType === "meeting") {
    return "Meeting"
  }

  if (eventType === "travel") {
    return "Travel"
  }

  if (eventType === "logistics") {
    return "Logistics"
  }

  return "Other"
}

function normalizeEventDateRange(event) {
  const startDate = event.startDate
  const endDate = event.endDate && event.endDate >= startDate ? event.endDate : startDate

  return {
    startDate,
    exclusiveEndDate: addCalendarDays(endDate, 1),
  }
}

export function buildTeamCalendarEventUid(event, uidHost = "dockout.app") {
  return `${event.sourceType}-${event.id}@${uidHost}`
}

function buildEventLines(input) {
  const event = input.event
  const { startDate, exclusiveEndDate } = normalizeEventDateRange(event)
  const stamp = toIcsDateTime(input.generatedAt)
  const updatedAt = event.updatedAt ? toIcsDateTime(event.updatedAt) : stamp
  const createdAt = event.createdAt ? toIcsDateTime(event.createdAt) : updatedAt
  const lines = [
    "BEGIN:VEVENT",
    `UID:${buildTeamCalendarEventUid(event, input.uidHost)}`,
    `DTSTAMP:${stamp}`,
    `CREATED:${createdAt}`,
    `LAST-MODIFIED:${updatedAt}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DTSTART;VALUE=DATE:${toIcsDate(startDate)}`,
    `DTEND;VALUE=DATE:${toIcsDate(exclusiveEndDate)}`,
    `CATEGORIES:${escapeIcsText(getEventTypeLabel(event.eventType))}`,
  ]

  if (event.venueName) {
    lines.push(`LOCATION:${escapeIcsText(event.venueName)}`)
  }

  if (event.notes) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.notes)}`)
  }

  if (event.url) {
    lines.push(`URL:${escapeIcsText(event.url)}`)
  }

  lines.push("END:VEVENT")
  return lines
}

export function buildTeamCalendarIcs(input) {
  const generatedAt = input.generatedAt ?? new Date()
  const calendarName = input.calendarName?.trim() || "Dockout Team Calendar"
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dockout//Team Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
  ]

  for (const event of input.events ?? []) {
    lines.push(
      ...buildEventLines({
        event,
        generatedAt,
        uidHost: input.uidHost ?? "dockout.app",
      }),
    )
  }

  lines.push("END:VCALENDAR")
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`
}
