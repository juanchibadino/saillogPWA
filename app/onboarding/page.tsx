import { redirect } from "next/navigation"

import { hasAppAccess, requireAuthenticatedAccessContext } from "@/lib/auth/access"
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow"

function trimValue(value: string | null | undefined): string {
  return (value ?? "").trim()
}

export default async function OnboardingPage() {
  const context = await requireAuthenticatedAccessContext()
  const hasAnyMembership =
    context.organizationMemberships.length > 0 || context.teamMemberships.length > 0

  if (hasAppAccess(context) || hasAnyMembership) {
    redirect("/dashboard")
  }

  const firstName = trimValue(context.profile?.first_name)
  const lastName = trimValue(context.profile?.last_name)

  return (
    <OnboardingFlow
      initialFirstName={firstName}
      initialLastName={lastName}
    />
  )
}
