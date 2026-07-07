import type { NavigationScope } from "@/lib/navigation/types"

export function AssessmentScopeFields({ scope }: { scope: NavigationScope }) {
  return (
    <>
      <input type="hidden" name="scopeOrgId" value={scope.activeOrgId} />
      {scope.activeTeamId ? (
        <input type="hidden" name="scopeTeamId" value={scope.activeTeamId} />
      ) : null}
    </>
  )
}
