import type { CSSProperties, ComponentProps } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const DEFAULT_CARD_BACKGROUND_IMAGE =
  "var(--team-home-card-gradient, linear-gradient(to top, oklab(0 0 0 / 0.03) 0%, transparent 100%))"
const DEFAULT_CARD_BORDER_COLOR = "var(--border)"

type GradientCardProps = ComponentProps<typeof Card> & {
  backgroundImage?: string
  borderColor?: string
}

function GradientCard({
  className,
  style,
  backgroundImage = DEFAULT_CARD_BACKGROUND_IMAGE,
  borderColor = DEFAULT_CARD_BORDER_COLOR,
  ...props
}: GradientCardProps) {
  const resolvedStyle: CSSProperties = {
    backgroundImage,
    borderColor,
    ...style,
  }

  return <Card className={cn(className)} style={resolvedStyle} {...props} />
}

export { GradientCard }
