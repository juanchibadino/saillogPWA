import {
  hasAppAccess,
  requireAuthenticatedAccessContext,
} from "@/lib/auth/access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const context = await requireAuthenticatedAccessContext();

  if (!hasAppAccess(context)) {
    return null;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">
          Initial access metrics for your Sailog account.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Global role</CardDescription>
            <CardTitle>{context.effectiveRoles.globalRole ?? "None"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Effective role from `profiles.global_role`.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Organization memberships</CardDescription>
            <CardTitle>{context.organizationMemberships.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Active rows in `organization_memberships`.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Team memberships</CardDescription>
            <CardTitle>{context.teamMemberships.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Active rows in `team_memberships`.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
