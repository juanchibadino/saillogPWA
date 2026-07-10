"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function VenueUnavailableRedirect({
  href,
}: {
  href: string
}) {
  const router = useRouter()

  React.useEffect(() => {
    toast.error("Venue unavailable. Returning to Team Home.", {
      id: "venue-unavailable-redirect",
    })
    router.replace(href)
  }, [href, router])

  return (
    <p className="sr-only" role="status">
      Redirecting to Team Home.
    </p>
  )
}
