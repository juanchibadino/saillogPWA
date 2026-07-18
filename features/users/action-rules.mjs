export function wouldRemoveAllAccessAfterUnlink(input) {
  const unlinkMembershipIds = new Set(input.unlinkMembershipIds)
  const remainingTeamMembershipIds = input.activeTeamMembershipIds.filter(
    (membershipId) => !unlinkMembershipIds.has(membershipId),
  )

  return (
    remainingTeamMembershipIds.length === 0 &&
    input.organizationMembershipCount === 0
  )
}
