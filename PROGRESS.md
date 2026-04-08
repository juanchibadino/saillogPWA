# PROGRESS.md

Last updated: 2026-04-08
Repository: `juanchibadino/saillogPWA`
Branch: `main`

## Current Snapshot

Sailog has completed bootstrap + Milestone 1 auth foundation:

- Next.js App Router + TypeScript + Tailwind + ESLint configured
- Supabase project linked (`gumxfgsvqnhrwgzwnuem`)
- Initial schema migration in repo and applied
- Vercel connected to GitHub and production deploy fixed
- Environment variables managed in Vercel (not in GitHub)
- Local development running with `.env.local`
- Phase 6 kickoff started with first vertical slice: `venues` CRUD

## Infrastructure Status

### Supabase
- Link active to project `Sailog` (`gumxfgsvqnhrwgzwnuem`)
- Migrations applied remotely with `npx supabase db push`:
  - `001_initial_schema.sql`
  - `002_auth_access_policies.sql`
  - `003_venues_access_policies.sql`

### Vercel
- Active project: `sailog` (renamed from `saillog`)
- Framework preset corrected to `Next.js`
- Domain `https://sailog.vercel.app` was verified serving app (HTTP 200)
- Required env vars should exist in Preview + Production:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY` (server-only, optional if needed)

### GitHub
- Remote: `git@github.com:juanchibadino/saillogPWA.git`
- Branch tracking: `main...origin/main`

## Milestone 1 Implemented (Local Code)

### Auth and protected shell
- Added sign-in flow (Email OTP magic link):
  - `/sign-in`
  - `/auth/otp`
  - `/auth/callback`
  - `/sign-out`
- Added protected app shell and dashboard:
  - `/dashboard`
- Added deny-by-default "Access pending" state for users without memberships

### Access context
- Added central server-side auth/access contract in:
  - `lib/auth/access.ts`
- Returns:
  - user
  - profile
  - organization memberships
  - team memberships
  - effective roles

### Database / RLS hardening
- Added migration `002_auth_access_policies.sql` with:
  - `auth_profile_id()`
  - `is_super_admin()`
  - `is_org_member(...)`
  - `is_team_member(...)`
  - trigger function `handle_new_auth_user()` to auto-create/update `public.profiles`
  - baseline RLS policies for:
    - `profiles`
    - `organization_memberships`
    - `team_memberships`
    - `organizations`
    - `teams`

### Typing
- Expanded `types/database.ts` for key auth/access tables and enums used in Milestone 1

## Phase 6 Kickoff Implemented (Local Code)

### Venues vertical slice
- Added `app/(app)/venues/page.tsx` with:
  - venues list
  - create venue form
  - edit venue form
- Added server-side data module:
  - `features/venues/data.ts`
- Added server actions for create/update:
  - `features/venues/actions.ts`
- Added Zod validation for writes:
  - `lib/validation/venues.ts`
- Added baseline RLS policies for venues:
  - `supabase/migrations/003_venues_access_policies.sql`

## Validation Completed

- `npm run lint` passes
- `npm run build` passes
- Build output includes routes:
  - `/`
  - `/sign-in`
  - `/auth/otp`
  - `/auth/callback`
  - `/dashboard`
  - `/sign-out`
  - `/venues`

## Git Status

- Milestone + Phase 6 kickoff commit pushed:
  - `82f81ba feat: milestone 1 auth, protected shell, baseline RLS, and venues CRUD kickoff`
- Branch is synced:
  - `main...origin/main`

## Immediate Next Step

1. Continue Phase 6 with `team_venue_seasons` CRUD slice.

Suggested commit message:

`feat: add team_venue_seasons CRUD vertical slice`

Then verify in production:

1. OTP login email delivery
2. Callback session creation
3. Access pending for user without memberships
4. Dashboard access for user with team/org membership

## Access Grant Runbook (SQL Editor)

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
   - insert into `team_memberships` with role (`team_admin`/`coach`/`crew`) and `is_active = true`
4. Validate app behavior:
   - no membership => `Access pending`
   - active membership => `/dashboard` access

## Notes

- `.env.local` must remain untracked
- Keep `.env.example` as contract template only
- Existing core operational CRUD (teams/venues/camps/sessions) is next after this commit
