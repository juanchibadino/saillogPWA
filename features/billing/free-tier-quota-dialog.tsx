"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  NAVIGATION_SCOPE_ORG_QUERY_KEY,
  NAVIGATION_SCOPE_TEAM_QUERY_KEY,
} from "@/lib/navigation/constants"

const PRO_PLAN_FEATURES = [
  "3 Teams",
  "Unlimited Venues",
  "Unlimited Camps",
  "Unlimited Sessions",
  "Assets for images, files and Vakaros",
]

const PRO_FEATURE_BADGE_LABEL = "Pro feature"
const PRO_FEATURE_TITLE = "This is a Pro feature"
const PRO_FEATURE_DESCRIPTION =
  "Upgrade to Pro to unlock higher creation limits, session uploads, and the full team workflow."

function buildUpgradeHref(input: {
  organizationId: string
  teamId?: string | null
}): string {
  const params = new URLSearchParams({
    [NAVIGATION_SCOPE_ORG_QUERY_KEY]: input.organizationId,
    tab: "billing",
  })

  if (input.teamId) {
    params.set(NAVIGATION_SCOPE_TEAM_QUERY_KEY, input.teamId)
  }

  return `/subscription?${params.toString()}`
}

export function FreeTierQuotaDialog(input: {
  organizationId: string
  teamId?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shouldOpen = searchParams.get("error") === "plan_limit_reached"

  function closeDialog(): void {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("error")
    const nextSearch = nextParams.toString()
    router.replace(nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname, {
      scroll: false,
    })
  }

  return (
    <Dialog
      open={shouldOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog()
        }
      }}
    >
      <ProFeatureUpgradeDialogContent
        organizationId={input.organizationId}
        teamId={input.teamId}
      />
    </Dialog>
  )
}

export function ProFeatureUpgradeDialog(input: {
  organizationId: string
  teamId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}) {
  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      <ProFeatureUpgradeDialogContent
        organizationId={input.organizationId}
        teamId={input.teamId}
        title={input.title}
        description={input.description}
      />
    </Dialog>
  )
}

function ProFeatureUpgradeDialogContent(input: {
  organizationId: string
  teamId?: string | null
  title?: string
  description?: string
}) {
  return (
    <DialogContent
      className="overflow-hidden p-0 sm:max-w-md"
      overlayClassName="bg-black/35 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
    >
      <DialogHeader className="gap-3 px-5 pt-5 pb-1">
        <div className="w-fit rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {PRO_FEATURE_BADGE_LABEL}
        </div>
        <div className="space-y-2">
          <DialogTitle className="text-xl leading-tight">
            {input.title ?? PRO_FEATURE_TITLE}
          </DialogTitle>
          <DialogDescription>
            {input.description ?? PRO_FEATURE_DESCRIPTION}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="px-5 py-4">
        <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
          {PRO_PLAN_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <CheckIcon className="size-3" />
              </span>
              <span className="font-medium">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-5 pt-4 pb-5 sm:justify-end">
        <Link
          href={buildUpgradeHref({
            organizationId: input.organizationId,
            teamId: input.teamId,
          })}
          className={buttonVariants({ className: "h-9 w-full sm:w-auto" })}
        >
          Upgrade to Pro
        </Link>
      </DialogFooter>
    </DialogContent>
  )
}
