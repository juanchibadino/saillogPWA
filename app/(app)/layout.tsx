import {
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";
import { resolveNavigationScope } from "@/lib/navigation/scope";
import type { ResolvedNavigationScope } from "@/lib/navigation/types";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function formatDisplayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : "Sailog User";
}

function formatUserRole(input: {
  globalRole: "super_admin" | null;
  organizationRoles: Array<"organization_admin">;
  teamRoles: Array<"team_admin" | "coach" | "crew">;
}): string {
  if (input.globalRole === "super_admin") {
    return "Super Admin";
  }

  if (input.organizationRoles.includes("organization_admin")) {
    return "Organization Admin";
  }

  if (input.teamRoles.includes("team_admin")) {
    return "Team Admin";
  }

  if (input.teamRoles.includes("coach")) {
    return "Coach";
  }

  if (input.teamRoles.includes("crew")) {
    return "Crew";
  }

  return "Member";
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuthenticatedAccessContext();
  const canAccessApp = hasAppAccess(context);
  let navigation: ResolvedNavigationScope | null = null;

  if (canAccessApp) {
    navigation = await resolveNavigationScope({
      context,
      searchParams: {},
    });
  }

  const userName = formatDisplayName(
    context.profile?.first_name ?? null,
    context.profile?.last_name ?? null,
  );
  const userEmail = context.user.email ?? "No email";
  const userRole = formatUserRole({
    globalRole: context.effectiveRoles.globalRole,
    organizationRoles: context.effectiveRoles.organizationRoles,
    teamRoles: context.effectiveRoles.teamRoles,
  });

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        canAccessApp={canAccessApp}
        navigation={navigation}
        user={{
          name: userName,
          email: userEmail,
          role: userRole,
          avatarUrl: context.profile?.photo_url ?? null,
        }}
      />
      <SidebarInset>
        <SiteHeader navigation={navigation} />
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
