const STANDARD_MOVE_NAME_MAX_LENGTH = 120
const STANDARD_MOVE_SUMMARY_MAX_LENGTH = 48
const STANDARD_MOVE_SUMMARY_MAX_WORDS = 4

type KeywordGroup = {
  label: string
  keywords: string[]
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "without",
  "during",
  "after",
  "before",
  "then",
  "that",
  "this",
])

const SIDE_GROUPS: KeywordGroup[] = [
  { label: "Port", keywords: ["port"] },
  { label: "Starboard", keywords: ["starboard", "stbd"] },
]

const CONTEXT_GROUPS: KeywordGroup[] = [
  { label: "Pin-End", keywords: ["pin end", "pin-end"] },
  { label: "Boat-End", keywords: ["boat end", "boat-end", "committee boat"] },
  { label: "Layline", keywords: ["layline", "lay line"] },
  { label: "Windward", keywords: ["windward"] },
  { label: "Leeward", keywords: ["leeward"] },
  { label: "Mark", keywords: ["mark", "top mark", "offset mark"] },
  { label: "Gate", keywords: ["gate"] },
  { label: "Line", keywords: ["start line", "line"] },
  { label: "Shift", keywords: ["shift", "header", "lift"] },
  { label: "Pressure", keywords: ["pressure", "puff", "lull"] },
  { label: "Current", keywords: ["current", "tide"] },
  { label: "Chop", keywords: ["chop", "waves", "wave", "sea state"] },
]

const ACTION_GROUPS: KeywordGroup[] = [
  { label: "Start", keywords: ["prestart", "pre-start", "start", "starting", "line up", "line-up"] },
  { label: "Exit", keywords: ["exit", "exiting", "bail out", "bail-out"] },
  { label: "Tack", keywords: ["tack", "tacking"] },
  { label: "Gybe", keywords: ["gybe", "gybing", "jibe", "jibing"] },
  { label: "Rounding", keywords: ["rounding", "round"] },
  { label: "Cross", keywords: ["cross", "crossing"] },
  { label: "Hoist", keywords: ["hoist", "hoisting", "set", "setting"] },
  { label: "Drop", keywords: ["drop", "dropping", "douse", "dousing", "takedown"] },
  { label: "Trim", keywords: ["trim", "trimming"] },
  { label: "Accelerate", keywords: ["accelerate", "acceleration", "build speed"] },
]

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function keywordToRegex(keyword: string): RegExp {
  const tokens = keyword
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
  const keywordPattern = tokens.map(escapeRegex).join("[\\s-]+")

  return new RegExp(`\\b${keywordPattern}\\b`)
}

function findFirstMatchingLabel(text: string, groups: KeywordGroup[]): string | null {
  let bestLabel: string | null = null
  let bestIndex = Number.POSITIVE_INFINITY

  for (const group of groups) {
    for (const keyword of group.keywords) {
      const matcher = keywordToRegex(keyword)
      const match = matcher.exec(text)

      if (!match || typeof match.index !== "number") {
        continue
      }

      if (match.index < bestIndex) {
        bestIndex = match.index
        bestLabel = group.label
      }
    }
  }

  return bestLabel
}

function formatSummaryToken(token: string): string {
  if (token.length === 0) {
    return token
  }

  if (/^[A-Z0-9-]+$/.test(token)) {
    return token
  }

  const normalized = token.toLowerCase()
  return `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`
}

function buildFallbackSummaryTokens(normalizedDescription: string): string[] {
  const rawTokens = normalizedDescription
    .replace(/[^A-Za-z0-9\s-]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  const filteredTokens = rawTokens.filter((token) => !STOP_WORDS.has(token.toLowerCase()))
  const candidateTokens = (filteredTokens.length > 0 ? filteredTokens : rawTokens)
    .slice(0, STANDARD_MOVE_SUMMARY_MAX_WORDS)
    .map(formatSummaryToken)

  return candidateTokens
}

function buildRuleBasedSummaryTokens(normalizedDescription: string): string[] {
  const searchableText = normalizedDescription.toLowerCase()
  const side = findFirstMatchingLabel(searchableText, SIDE_GROUPS)
  const context = findFirstMatchingLabel(searchableText, CONTEXT_GROUPS)
  const action = findFirstMatchingLabel(searchableText, ACTION_GROUPS)
  const tokens: string[] = []

  if (side) {
    tokens.push(side)
  }

  if (context && context !== side) {
    tokens.push(context)
  }

  if (action) {
    tokens.push(action)
  }

  const uniqueTokens: string[] = []

  for (const token of tokens) {
    if (!uniqueTokens.includes(token)) {
      uniqueTokens.push(token)
    }
  }

  return uniqueTokens
}

function clampSummary(summary: string): string {
  let tokens = summary
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  if (tokens.length > STANDARD_MOVE_SUMMARY_MAX_WORDS) {
    tokens = tokens.slice(0, STANDARD_MOVE_SUMMARY_MAX_WORDS)
  }

  let clamped = tokens.join(" ").trim()

  while (clamped.length > STANDARD_MOVE_SUMMARY_MAX_LENGTH && tokens.length > 1) {
    tokens = tokens.slice(0, -1)
    clamped = tokens.join(" ").trim()
  }

  if (clamped.length > STANDARD_MOVE_SUMMARY_MAX_LENGTH) {
    clamped = clamped.slice(0, STANDARD_MOVE_SUMMARY_MAX_LENGTH).trim()
  }

  return clamped
}

export function generateStandardMoveNameFromDescription(
  description: string,
  fallback = "Standard Move",
): string {
  const normalizedDescription = description.replace(/\s+/g, " ").trim()

  if (normalizedDescription.length === 0) {
    return fallback
  }

  const ruleBasedTokens = buildRuleBasedSummaryTokens(normalizedDescription)
  const fallbackTokens = buildFallbackSummaryTokens(normalizedDescription)
  const baseSummary =
    ruleBasedTokens.length > 0 ? ruleBasedTokens.join(" ") : fallbackTokens.join(" ")
  const shortSummary = clampSummary(baseSummary)
  const truncatedName = shortSummary.slice(0, STANDARD_MOVE_NAME_MAX_LENGTH).trim()

  return truncatedName.length > 0 ? truncatedName : fallback
}
