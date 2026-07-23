import { SettingsFeedback } from "@/features/settings/settings-feedback"
import { SettingsPageClient } from "@/features/settings/settings-page-client"
import { getSettingsPageData } from "@/features/settings/data"
import { requireAuthenticatedAccessContext } from "@/lib/auth/access"
import {
  getSingleSearchParamValue,
  resolveNavigationScope,
} from "@/lib/navigation/scope"

type SettingsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function getStatusMessage(status: string | undefined): string | null {
  if (status === "user_updated") {
    return "User settings saved."
  }

  if (status === "email_verification_sent") {
    return "Verification email sent. Confirm the change before using the new email."
  }

  if (status === "email_confirmed") {
    return "Email verified successfully."
  }

  if (status === "notifications_updated") {
    return "Notification settings saved."
  }

  if (status === "organization_updated") {
    return "Organization settings saved."
  }

  if (status === "team_updated") {
    return "Team settings saved."
  }

  return null
}

function getErrorMessage(error: string | undefined): string | null {
  if (error === "invalid_input") {
    return "The submitted settings are invalid. Review the form and try again."
  }

  if (error === "forbidden") {
    return "You do not have permission to edit those settings."
  }

  if (error === "email_update_failed") {
    return "Could not start the email verification flow. Confirm the email and try again."
  }

  if (error === "update_failed") {
    return "Could not save settings. Confirm your permissions and try again."
  }

  return null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SettingsSearchParams
}) {
  const context = await requireAuthenticatedAccessContext()
  const resolvedSearchParams = await searchParams
  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  })
  const status = getSingleSearchParamValue(resolvedSearchParams.status)
  const error = getSingleSearchParamValue(resolvedSearchParams.error)
  const selectedTab = getSingleSearchParamValue(resolvedSearchParams.tab)
  const data = getSettingsPageData({
    context,
    navigation,
  })

  return (
    <div className="space-y-6">
      <SettingsFeedback
        statusMessage={getStatusMessage(status)}
        errorMessage={getErrorMessage(error)}
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Edit your profile, active scopes, and notification preferences.
        </p>
      </div>

      <SettingsPageClient
        data={data}
        initialTab={selectedTab}
        scope={{
          activeOrgId: navigation.scope?.activeOrgId,
          activeTeamId: navigation.scope?.activeTeamId,
        }}
      />
    </div>
  )
}
