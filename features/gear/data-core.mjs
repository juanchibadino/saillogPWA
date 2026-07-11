export const TEAM_GEAR_PAGE_SIZE = 25

export function resolveTeamGearVisibleRange(input) {
  const pageSize = input.pageSize ?? TEAM_GEAR_PAGE_SIZE
  const currentPage = Math.max(1, Math.floor(input.currentPage))

  if (input.accumulatePages) {
    return {
      rangeStart: 0,
      rangeEnd: currentPage * pageSize - 1,
    }
  }

  const rangeStart = (currentPage - 1) * pageSize

  return {
    rangeStart,
    rangeEnd: rangeStart + pageSize - 1,
  }
}
