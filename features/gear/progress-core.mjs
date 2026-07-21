function getRuleUsageValue(gearItem, rule) {
  return rule.metric === "usage_minutes" ? gearItem.usageMinutes : gearItem.usageCount
}

export function getGearProgressIndicatorClassName(alertState) {
  if (alertState === "warning") {
    return "bg-red-500"
  }

  if (alertState === "critical") {
    return "bg-amber-400"
  }

  return "bg-emerald-500"
}

export function buildGearProgressModel(gearItem) {
  let selectedRule = null
  let selectedUsageValue = 0
  let selectedRatio = 0

  for (const rule of gearItem.alertRules) {
    if (rule.severity !== "warning" || rule.thresholdValue <= 0) {
      continue
    }

    const usageValue = getRuleUsageValue(gearItem, rule)
    const ratio = usageValue / rule.thresholdValue

    if (!selectedRule || ratio > selectedRatio) {
      selectedRule = rule
      selectedUsageValue = usageValue
      selectedRatio = ratio
    }
  }

  const rawPercent = selectedRule ? selectedRatio * 100 : 0
  const visualPercent = Math.min(100, Math.max(0, rawPercent))

  return {
    rule: selectedRule,
    usageValue: selectedUsageValue,
    thresholdValue: selectedRule?.thresholdValue ?? 0,
    rawPercent,
    visualPercent,
    indicatorClassName: getGearProgressIndicatorClassName(gearItem.alertState),
  }
}
