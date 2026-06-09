# PROJECT_STATE.md

Last updated: 2026-05-19

## 1. Current Focus

Continue the core operational app build after Milestone 1, focused on team-scoped operational pages.

The immediate implementation focus is Phase 6 UI and CRUD completion for:

- Team Venue pages and ID pages
- Team Camp pages and ID pages
- Team Session pages and ID pages
- Session ID tabs, especially the daily-use review/setup/detail tabs

The next safest slice is to continue from the existing team venue, camp, and session patterns and make the session detail experience consistent, mobile-friendly, and operationally useful before broadening scope.

## 2. Current UI Direction

Use a practical mobile-first PWA interface for the active operational pages:

- Use drawers for create/edit CRUD flows
- Use bigger primary actions and tap targets
- Keep UI patterns consistent across Team Venue, Team Camp, and Team Session pages
- Avoid wide multi-column tables as the primary mobile experience
- Prefer tappable cards and compact list views
- Use horizontal scroll only where cards need side-by-side comparison
- Add filters for operational lists, with mobile filters opening in a drawer/sheet
- Keep session ID tabs clear, fast to scan, and optimized for coach/crew workflows

Near-term deferred modules after the core operational pages:

- Team Gear
- Team Reports
- Team Standard Moves
- Team Notes

PWA speed and installability come after the core operational workflows:

- safe areas
- install manifest
- service worker only if needed
- optimistic UI
- caching and prefetching
- offline drafts if useful

## 3. System Page Map

Use this map before searching. It lists the main route files and the most relevant feature files for each active system area.

### Team Home

- Page: `app/(app)/team-home/page.tsx`
- Loading: `app/(app)/team-home/loading.tsx`
- Data: `features/team-home/data.ts`

### Team Venues

- Page: `app/(app)/team-venues/page.tsx`
- Loading: `app/(app)/team-venues/loading.tsx`
- Main UI: `features/team-venues/team-venues-table.tsx`
- Toolbar/filters: `features/team-venues/team-venues-toolbar.tsx`
- Feedback: `features/team-venues/team-venues-feedback.tsx`
- Data/actions: `features/team-venues/data.ts`, `features/team-venues/actions.ts`
- Current gap: no `app/(app)/team-venues/[id]/page.tsx` route exists yet

### Team Camps

- Page: `app/(app)/team-camps/page.tsx`
- ID page: `app/(app)/team-camps/[id]/page.tsx`
- Loading: `app/(app)/team-camps/loading.tsx`, `app/(app)/team-camps/[id]/loading.tsx`
- Main UI: `features/camps/camps-table.tsx`
- CRUD dialogs/drawers: `features/camps/camp-form-dialogs.tsx`
- ID tabs: `features/camps/camp-detail-tabs-client.tsx`
- Navigation: `features/camps/navigation.ts`
- Feedback: `features/camps/camps-feedback.tsx`
- Data/actions: `features/camps/data.ts`, `features/camps/detail-data.ts`, `features/camps/actions.ts`
- Detail types: `features/camps/detail-types.ts`

### Team Sessions

- Page: `app/(app)/team-sessions/page.tsx`
- ID page: `app/(app)/team-sessions/[id]/page.tsx`
- Loading: `app/(app)/team-sessions/loading.tsx`, `app/(app)/team-sessions/[id]/loading.tsx`
- Main UI: `features/sessions/sessions-table.tsx`
- Toolbar/filters: `features/sessions/team-sessions-toolbar.tsx`
- CRUD dialogs/drawers: `features/sessions/session-form-dialogs.tsx`
- ID tabs: `features/sessions/session-detail-tabs-client.tsx`
- Mobile summary: `features/sessions/session-mobile-summary.tsx`
- Navigation: `features/sessions/navigation.ts`
- Feedback: `features/sessions/sessions-feedback.tsx`
- Data/actions: `features/sessions/data.ts`, `features/sessions/detail-data.ts`, `features/sessions/actions.ts`
- Detail types: `features/sessions/detail-types.ts`
- Breadcrumb API: `app/api/team-sessions/[id]/breadcrumb/route.ts`

### Venues

- Page: `app/(app)/venues/page.tsx`
- ID page: `app/(app)/venues/[id]/page.tsx`
- Loading: `app/(app)/venues/loading.tsx`, `app/(app)/venues/[id]/loading.tsx`
- Main UI: `features/venues/venues-table.tsx`
- CRUD dialogs/drawers: `features/venues/venue-form-dialogs.tsx`
- ID tabs: `features/venues/venue-detail-tabs-client.tsx`
- Assessments panel: `features/venues/venue-assessments-panel.tsx`
- Navigation: `features/venues/navigation.ts`
- Feedback: `features/venues/venues-feedback.tsx`
- Data/actions: `features/venues/data.ts`, `features/venues/detail-data.ts`, `features/venues/actions.ts`, `features/venues/assessment-actions.ts`
- Detail types: `features/venues/detail-types.ts`
- Breadcrumb API: `app/api/venues/[id]/breadcrumb/route.ts`

### Team Gear

- Page: `app/(app)/team-gear/page.tsx`
- Loading: `app/(app)/team-gear/loading.tsx`
- Main UI: `features/gear/gear-table.tsx`
- Toolbar/filters: `features/gear/team-gear-toolbar.tsx`
- CRUD dialogs/drawers: `features/gear/gear-form-dialogs.tsx`
- Feedback: `features/gear/gear-feedback.tsx`
- Data/actions: `features/gear/data.ts`, `features/gear/actions.ts`

### Team Reports

- Page: `app/(app)/team-reports/page.tsx`
- Loading: `app/(app)/team-reports/loading.tsx`
- Shared reports page: `app/(app)/reports/page.tsx`
- Main UI: `features/reports/reports-table.tsx`
- CRUD dialogs/drawers: `features/reports/report-form-dialogs.tsx`
- PDF/API: `features/reports/pdf.ts`, `app/api/reports/[id]/pdf/route.ts`
- Data/actions: `features/reports/data.ts`, `features/reports/actions.ts`

### Team Standard Moves

- Page: `app/(app)/team-standard-moves/page.tsx`
- Loading: `app/(app)/team-standard-moves/loading.tsx`
- Main UI: `features/standard-moves/standard-moves-table.tsx`
- Toolbar/filters: `features/standard-moves/team-standard-moves-toolbar.tsx`
- CRUD dialogs/drawers: `features/standard-moves/standard-moves-form-dialogs.tsx`
- Feedback: `features/standard-moves/standard-moves-feedback.tsx`
- Data/actions: `features/standard-moves/data.ts`, `features/standard-moves/actions.ts`

### Team Notes

- Page: `app/(app)/team-notes/page.tsx`
- Loading: `app/(app)/team-notes/loading.tsx`
- Main UI: `features/notes/team-notes-cards.tsx`
- Toolbar/filters: `features/notes/team-notes-toolbar.tsx`
- Data: `features/notes/data.ts`

### Shared App Shell

- App layout: `app/(app)/layout.tsx`
- Global layout: `app/layout.tsx`
- Sidebar: `components/app-sidebar.tsx`, `components/ui/sidebar.tsx`
- Header: `components/site-header.tsx`
- Shared filters: `components/shared/table-filters-toolbar.tsx`
- Shared skeletons: `components/shared/page-skeletons.tsx`

## 4. Current Snapshot

Sailog has completed the bootstrap and Milestone 1 auth foundation:

- Next.js App Router, TypeScript, Tailwind, and ESLint are configured
- Supabase project is linked to `gumxfgsvqnhrwgzwnuem`
- Initial schema migration exists in the repo and has been applied
- Vercel is connected to GitHub and production deploy was fixed
- Environment variables are managed in Vercel, not GitHub
- Local development runs with `.env.local`
- Protected dashboard shell exists
- Auth flow uses Email OTP magic links
- Users without memberships see a deny-by-default access pending state
- Phase 6 has started with the `venues` CRUD vertical slice
- Magic-link redirect origin fix has been deployed for production auth emails

## 5. Infrastructure Status

### Supabase

- Project: `Sailog`
- Project id: `gumxfgsvqnhrwgzwnuem`
- Remote migrations applied with `npx supabase db push`:
  - `001_initial_schema.sql`
  - `002_auth_access_policies.sql`
  - `003_venues_access_policies.sql`

### Vercel

- Active project: `sailog`
- Production URL: `https://sailog.vercel.app`
- Framework preset: `Next.js`
- Required environment variables should exist in Preview and Production:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
- Production also has:
  - `NEXT_PUBLIC_APP_URL=https://sailog.vercel.app`

### GitHub

- Remote: `git@github.com:juanchibadino/saillogPWA.git`
- Main branch: `main`

## 6. Implemented Milestone 1

### Auth and Protected Shell

- Added sign-in flow:
  - `/sign-in`
  - `/auth/otp`
  - `/auth/callback`
  - `/sign-out`
- Added protected app shell and dashboard:
  - `/dashboard`
- Added access pending state for signed-in users without active memberships

### Access Context

- Central server-side auth/access contract:
  - `lib/auth/access.ts`
- Resolves:
  - user
  - profile
  - organization memberships
  - team memberships
  - effective roles

### Database and RLS Foundation

- Added `002_auth_access_policies.sql`
- Includes:
  - `auth_profile_id()`
  - `is_super_admin()`
  - `is_org_member(...)`
  - `is_team_member(...)`
  - `handle_new_auth_user()` profile trigger
  - baseline RLS policies for `profiles`, memberships, `organizations`, and `teams`

### Typing

- Expanded `types/database.ts` for auth/access tables and enums used by Milestone 1

## 7. Implemented Phase 6 Kickoff

### Venues Vertical Slice

- Added venues list, create form, and edit form:
  - `app/(app)/venues/page.tsx`
- Added server-side data module:
  - `features/venues/data.ts`
- Added server actions:
  - `features/venues/actions.ts`
- Added Zod validation:
  - `lib/validation/venues.ts`
- Added venue RLS policies:
  - `supabase/migrations/003_venues_access_policies.sql`

## 8. Validation Status

Last known validation passed:

- `npm run lint`
- `npm run build`

Last known build included routes:

- `/`
- `/sign-in`
- `/auth/otp`
- `/auth/callback`
- `/dashboard`
- `/sign-out`
- `/venues`

These checks should be rerun after the next implementation slice because the worktree has changed since the last recorded validation.

## 9. Production Auth Fix

The magic-link redirect issue was fixed.

Root cause:

- Email links were sometimes generated with a localhost origin.

Callback origin resolution now uses this order:

1. `NEXT_PUBLIC_APP_URL`
2. request `Origin` header
3. forwarded host/proto headers
4. request URL origin fallback

Updated files:

- `app/auth/otp/route.ts`
- `lib/supabase/env.ts`
- `.env.example`
- `README.md`

## 10. Recent Git Milestones

- `82f81ba feat: milestone 1 auth, protected shell, baseline RLS, and venues CRUD kickoff`
- `1a9559c docs: refresh progress status after milestone push`
- `fca6296 fix: stabilize magic-link redirect origin`

## 11. Immediate Next Steps

1. Review Team Venue, Team Camp, Team Session, and Session ID tab pages for consistency.
2. Standardize CRUD into drawers with visible saving states and larger actions.
3. Replace or reduce multi-column table-heavy layouts with tappable card/list experiences where appropriate.
4. Add list filters, using drawer/sheet filters on mobile.
5. Verify the current schema/table naming before changing data flows.
6. Keep changes small and avoid introducing new abstractions unless existing patterns are insufficient.
7. Rerun `npm run lint` and `npm run build` after implementation.

Production checks after the next deploy:

1. OTP login email delivery
2. Magic-link callback returns to `https://sailog.vercel.app`
3. User without memberships sees access pending
4. User with active org/team membership reaches the dashboard

## 12. Access Grant Runbook

Root cause for error `P0001: No auth user found for that email yet`:

- grant SQL ran before the user existed in `auth.users`
- the user must request sign-in first at `/sign-in`

Recommended sequence:

1. User requests magic link at `/sign-in`.
2. Verify user/profile rows exist:
   - `select id, email from auth.users where lower(email) = lower('<email>');`
   - `select id, email from public.profiles where lower(email) = lower('<email>');`
3. Grant memberships with `insert ... select` from `auth.users`:
   - insert into `organization_memberships` with role `organization_admin`
   - insert into `team_memberships` with role `team_admin`, `coach`, or `crew` and `is_active = true`
4. Validate app behavior:
   - no membership means `Access pending`
   - active membership means `/dashboard` access

## 13. Notes and Constraints

- `AGENTS.md` is the canonical project instruction document
- `.env.local` must remain untracked
- `.env.example` is a contract template only
- Use migrations for schema changes
- Keep RLS enabled on all public tables
- Preserve the frozen domain model unless the product owner explicitly changes it
- Do not recreate Glide helper/computed tables unless they represent real business data
- Gear, assessments, deep offline sync, notifications, and generic workflow automation remain out of MVP scope
