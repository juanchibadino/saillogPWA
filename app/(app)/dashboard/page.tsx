import {
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";
import { resolveNavigationScope } from "@/lib/navigation/scope";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const context = await requireAuthenticatedAccessContext();

  if (!hasAppAccess(context)) {
    return null;
  }

  const resolvedSearchParams = await searchParams;
  const navigation = await resolveNavigationScope({
    context,
    searchParams: resolvedSearchParams,
  });

  if (!navigation.scope) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-900">No active scope</h1>
        <p className="mt-2 text-sm text-amber-800">
          Your account has app access but no active organization context is
          currently available.
        </p>
      </section>
    );
  }

  const scope = navigation.scope;
  const activeOrganization =
    navigation.catalog.organizations.find(
      (organization) => organization.id === scope.activeOrgId,
    ) ?? null;
  const teamsForOrganization =
    navigation.catalog.teamsByOrganizationId[scope.activeOrgId] ?? [];
  const teamsInScopeCount = scope.activeTeamId ? 1 : 0;

  const activeTeamLabel =
    teamsForOrganization.find((team) => team.id === scope.activeTeamId)?.name ??
    "No team selected";

  const supabase = await createServerSupabaseClient();
  const { count: venuesCount } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", scope.activeOrgId);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Operational metrics for your active organization.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Organization</CardDescription>
            <CardTitle>{activeOrganization?.name ?? "Unknown"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Active `org` query scope.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Team scope</CardDescription>
            <CardTitle>{activeTeamLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Active `team` query scope.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teams in scope</CardDescription>
            <CardTitle>{teamsInScopeCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Team scope is now always a single team or none.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Venues in organization</CardDescription>
            <CardTitle>{venuesCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Organization-owned venue master records.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
