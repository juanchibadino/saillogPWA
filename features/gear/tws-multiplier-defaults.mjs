/**
 * Resolve the default TWS multiplier for an ordered option.
 * optionOrder is one-based and follows the active TWS option position.
 */
export function getDefaultTwsMultiplier(optionOrder, optionCount) {
  const safeOptionCount = Math.max(1, Math.floor(optionCount))
  const safeOptionOrder = Math.min(
    safeOptionCount,
    Math.max(1, Math.floor(optionOrder)),
  )

  if (safeOptionCount === 1) {
    return 1
  }

  if (safeOptionCount === 2) {
    return safeOptionOrder === 1 ? 0.5 : 1
  }

  if (safeOptionCount === 3) {
    return [0.4, 0.6, 1][safeOptionOrder - 1] ?? 1
  }

  if (safeOptionCount === 4) {
    return [0.3, 0.5, 0.7, 1][safeOptionOrder - 1] ?? 1
  }

  if (safeOptionCount === 5) {
    return [0.2, 0.4, 0.6, 0.8, 1][safeOptionOrder - 1] ?? 1
  }

  const multiplier = 0.1 + (safeOptionOrder - 1) * (0.9 / (safeOptionCount - 1))

  return Math.round(multiplier * 100) / 100
}
