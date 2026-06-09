"use client"

import { FeedbackToast } from "@/components/shared/feedback-toast"

export function TeamVenuesFeedback({
  statusMessage,
  errorMessage,
}: {
  statusMessage: string | null
  errorMessage: string | null
}) {
  return (
    <FeedbackToast
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      statusParamKey="result"
    />
  )
}
