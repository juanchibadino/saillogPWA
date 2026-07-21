export type VakarosParseMetadata = {
  rowsRaw: number
  rows1Hz: number
  startAt: string
  endAt: string
  durationHours: number
  distanceNm: number
  avgSogKts: number
  p95SogKts: number
  maxSogKts: number
}

export type VakarosParseResult = {
  metadata: VakarosParseMetadata
  series1HzCsv: string
  summaryCsv: string
  trackGeojson: string
}

export const VAKAROS_REQUIRED_COLUMNS: string[]

export function parseVakarosCsv(
  csvText: string,
  options?: {
    geojsonSampleEvery?: number
  },
): VakarosParseResult

export function assertValidVakarosCsvFileName(fileName: string): boolean
