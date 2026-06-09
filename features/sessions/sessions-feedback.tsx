"use client"

import { FeedbackToast } from "@/components/shared/feedback-toast"

export function SessionsFeedback({
  statusMessage,
  errorMessage,
}: {
  statusMessage: string | null
  errorMessage: string | null
}) {
  return <FeedbackToast statusMessage={statusMessage} errorMessage={errorMessage} />
}
