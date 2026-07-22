export type VakarosSavedTrimBuoy = {
  id: string
  lat: number
  lon: number
  mode: "windward" | "leeward"
}

export type VakarosSavedTrimInput = {
  buoysPayload: string
  fallbackName: string
  maxIndex: number
  name?: string
  savedTrimId?: string
  sessionId?: string
  trimEndIndex: number
  trimStartIndex: number
  uploadId?: string
}

export type NormalizedVakarosSavedTrimInput = {
  buoys: VakarosSavedTrimBuoy[]
  name: string
  trimEndIndex: number
  trimStartIndex: number
}

export const VAKAROS_SAVED_TRIM_MAX_BUOYS: number
export const VAKAROS_SAVED_TRIM_MAX_NAME_LENGTH: number
export const VAKAROS_SAVED_TRIM_BUOYS_PAYLOAD_MAX_LENGTH: number

export function normalizeVakarosSavedTrimName(
  value: string | undefined,
  fallbackName: string,
): string

export function normalizeVakarosSavedTrimBuoys(
  value: unknown,
): VakarosSavedTrimBuoy[] | null

export function parseVakarosSavedTrimBuoysPayload(
  value: string | undefined,
): VakarosSavedTrimBuoy[] | null

export function normalizeVakarosSavedTrimInput(
  input: VakarosSavedTrimInput,
): NormalizedVakarosSavedTrimInput | null
