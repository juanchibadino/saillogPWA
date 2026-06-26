import type { CSSProperties, ComponentProps } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const DEFAULT_CARD_BACKGROUND_IMAGE =
  "var(--team-home-card-gradient, linear-gradient(to top, oklab(0 0 0 / 0.03) 0%, transparent 100%))"

type GradientCardProps = ComponentProps<typeof Card> & {
  backgroundImage?: string
  borderColor?: string
}

function GradientCard({
  className,
  style,
  backgroundImage = DEFAULT_CARD_BACKGROUND_IMAGE,
  borderColor,
  ...props
}: GradientCardProps) {
  const resolvedStyle: CSSProperties = {
    backgroundImage,
    ...(borderColor ? { borderColor } : {}),
    ...style,
  }

  return <Card className={cn(className)} style={resolvedStyle} {...props} />
}

export { GradientCard }
