const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const usDatePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/

function isValidDateParts(input: {
  day: number
  month: number
  year: number
}): boolean {
  const date = new Date(Date.UTC(input.year, input.month - 1, input.day))

  return (
    date.getUTCFullYear() === input.year &&
    date.getUTCMonth() === input.month - 1 &&
    date.getUTCDate() === input.day
  )
}

function parseUsDateInput(value: string): string | null {
  const match = value.trim().match(usDatePattern)

  if (!match) {
    return null
  }

  const [, month, day, year] = match
  const parsedDate = {
    day: Number.parseInt(day, 10),
    month: Number.parseInt(month, 10),
    year: Number.parseInt(year, 10),
  }

  if (!isValidDateParts(parsedDate)) {
    return null
  }

  return `${year}-${month}-${day}`
}

export function normalizeUsDateInput(value: string): string | null {
  const trimmedValue = value.trim()
  const isoMatch = trimmedValue.match(isoDatePattern)

  if (isoMatch) {
    const [, year, month, day] = isoMatch

    if (
      isValidDateParts({
        day: Number.parseInt(day, 10),
        month: Number.parseInt(month, 10),
        year: Number.parseInt(year, 10),
      })
    ) {
      return trimmedValue
    }

    return null
  }

  return parseUsDateInput(trimmedValue)
}
