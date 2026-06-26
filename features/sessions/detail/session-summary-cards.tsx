import { GradientCard } from "@/components/shared/gradient-card"
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SessionDetailSummaryCardsProps = {
  sessionTypeLabel: string
  sessionDateLabel: string
  dockOutLabel: string
  durationLabel: string
}

export function SessionDetailSummaryCards({
  sessionTypeLabel,
  sessionDateLabel,
  dockOutLabel,
  durationLabel,
}: SessionDetailSummaryCardsProps) {
  const summaryItems = [
    { label: "Type", value: sessionTypeLabel, isTabular: false },
    { label: "Date", value: sessionDateLabel, isTabular: false },
    { label: "Dock Out", value: dockOutLabel, isTabular: true },
    { label: "Duration", value: durationLabel, isTabular: true },
  ]

  return (
    <>
      <GradientCard className="overflow-hidden p-0 md:hidden">
        <div className="divide-y divide-border px-6 py-3">
          {summaryItems.map((item) => (
            <div
              key={`mobile-session-summary-${item.label}`}
              className="flex min-h-12 items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "text-right text-sm font-semibold",
                  item.isTabular ? "tabular-nums" : null,
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </GradientCard>

      <div className="hidden gap-4 md:grid md:grid-cols-4">
        {summaryItems.map((item) => (
          <GradientCard key={`desktop-session-summary-${item.label}`}>
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle
                className={cn(
                  "text-xl font-semibold",
                  item.isTabular ? "tabular-nums" : null,
                )}
              >
                {item.value}
              </CardTitle>
            </CardHeader>
          </GradientCard>
        ))}
      </div>
    </>
  )
}
