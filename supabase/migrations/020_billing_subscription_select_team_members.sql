-- 020_billing_subscription_select_team_members.sql
-- Allow team members to read organization subscription tier so header plan badges
-- reflect the organization's paid plan even for crew-only users.

drop policy if exists organization_subscriptions_select_chain on public.organization_subscriptions;
create policy organization_subscriptions_select_chain
on public.organization_subscriptions
for select
using (
  public.is_super_admin()
  or public.is_org_member(organization_id)
  or exists (
    select 1
    from public.teams t
    where t.organization_id = organization_subscriptions.organization_id
      and public.is_team_member(t.id)
  )
);
