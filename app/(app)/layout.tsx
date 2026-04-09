import {
  type AuthenticatedAccessContext,
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatDisplayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : "Sailog User";
}

type SidebarBranding = {
  organizationName: string | null;
  teamName: string | null;
  avatarUrl: string | null;
};

async function getSidebarBranding(
  context: AuthenticatedAccessContext,
): Promise<SidebarBranding> {
  const defaultBranding: SidebarBranding = {
    organizationName: null,
    teamName: null,
    avatarUrl: null,
  };
  const firstTeamMembership = context.teamMemberships[0] ?? null;
  const firstOrganizationMembership = context.organizationMemberships[0] ?? null;
  let organizationId = firstOrganizationMembership?.organization_id ?? null;
  let teamName: string | null = null;

  if (!firstTeamMembership && !organizationId) {
    return defaultBranding;
  }

  const supabase = await createServerSupabaseClient();

  if (firstTeamMembership) {
    const { data: team } = await supabase
      .from("teams")
      .select("name, organization_id")
      .eq("id", firstTeamMembership.team_id)
      .eq("is_active", true)
      .maybeSingle();

    if (team) {
      teamName = team.name;
      organizationId = team.organization_id;
    }
  }

  let organizationName: string | null = null;

  if (organizationId) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .eq("is_active", true)
      .maybeSingle();

    if (organization) {
      organizationName = organization.name;
    }
  }

  return {
    organizationName,
    teamName,
    avatarUrl: null,
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuthenticatedAccessContext();
  const canAccessApp = hasAppAccess(context);
  const sidebarBranding = await getSidebarBranding(context);
  const userName = formatDisplayName(
    context.profile?.first_name ?? null,
    context.profile?.last_name ?? null,
  );
  const userEmail = context.user.email ?? "No email";

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        canAccessApp={canAccessApp}
        brand={sidebarBranding}
        user={{ name: userName, email: userEmail }}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            {canAccessApp ? (
              children
            ) : (
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
                <h1 className="text-xl font-semibold text-amber-900">Access pending</h1>
                <p className="mt-2 text-sm text-amber-800">
                  Your account is authenticated but has no active organization or team
                  membership yet.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                  Ask a team admin to add your membership before continuing.
                </p>
              </section>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
