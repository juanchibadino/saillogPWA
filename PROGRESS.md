# PROGRESS.md

Last updated: 2026-06-20
Repository: `juanchibadino/saillogPWA`
Branch: `main`

## 2026-06-21 - Session header actions restored

- Restored `/team-sessions/[id]` header actions so `Setup` and `Edit` render together on the right side of the session title row.
- Moved the session metadata edit trigger back out of the title area and restored the visible `Edit` label while preserving the mobile Drawer and desktop Sheet edit surfaces.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session header edit action placement

- Updated `/team-sessions/[id]` header so `Setup` remains in the right-side action area while the session metadata edit action moves next to the session type title.
- Changed the session metadata edit trigger in `features/sessions/session-detail-tabs-client.tsx` to an icon-only pencil button that still opens the mobile Drawer or desktop Sheet.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup save performance audit fixes

- Optimized `/team-sessions/[id]` Setup saves in `features/sessions/session-detail-tabs-client.tsx` and `features/sessions/actions.ts` so the client submits only changed setup items and only sends boat metric order when it actually changed.
- Updated `saveSessionSetupAction` to bulk delete/upsert/insert changed setup values/options, skip unchanged reorder work, avoid the full post-save setup snapshot query, and revalidate only the session detail path for Setup value saves.
- Removed intermediate `Saving...` toasts from Setup and Info optimistic saves so the user only sees confirmation or error feedback.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup save optimistic UI

- Added an optimistic save path for `/team-sessions/[id]` Setup edits using a new result-returning `saveSessionSetupAction` while keeping `updateSessionSetupAction` as the redirect fallback.
- Updated `features/sessions/session-detail-tabs-client.tsx` so saving Setup immediately exits edit mode, closes the Drawer/Sheet, shows the edited values/order, uses a stable success/error toast id, reconciles through route refresh, and reopens edit mode on failure.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session feedback toast dedupe

- Updated session detail save feedback in `features/sessions/sessions-feedback.tsx` so URL-driven Sonner toasts use stable ids per route/status or route/error.
- Prevents duplicate stacked messages when Setup save redirects are processed more than once during refresh/dev rendering.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup edit metric row layout

- Updated `/team-sessions/[id]` Setup edit rows in `features/sessions/session-detail-tabs-client.tsx` so metric titles like TWD render above the multiselect badge field instead of beside it.
- Kept Boat metric template action icons in the row header while the editable input area stays full-width below the title.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Setup data editor drawer sheet

- Updated `/team-sessions/[id]` Setup editor in `features/sessions/session-detail-tabs-client.tsx` from a shared Dialog to the standard mobile Drawer and desktop right Sheet pattern.
- Kept the long setup content in a dedicated scrollable middle region with fixed header/footer actions so Weather/Boat metrics remain usable on smaller viewports.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session duration stepper

- Updated `/team-sessions/[id]` `Edit Session` duration in `features/sessions/session-detail-tabs-client.tsx` from a free numeric input to a required quarter-hour stepper with `-` and `+` controls and `h/m` display.
- Updated `lib/validation/sessions.ts` so session detail edits require `Start Time (UTC)` and a 15-minute increment `Total Duration`.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-20 - Session edit drawer height

- Updated `/team-sessions/[id]` mobile `Edit Session` drawer in `features/sessions/session-detail-tabs-client.tsx` to use content-sized height with an 85dvh max, removing the large empty gap under the short metadata form while keeping overflow constrained.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session detail edit drawer sheet

- Updated `/team-sessions/[id]` session metadata edit in `features/sessions/session-detail-tabs-client.tsx` to use the standard mobile Drawer and desktop right Sheet pattern.
- Kept the existing update action and form fields, with fixed header/footer and scrolleable form content inside the edit surface.
- Changed the session metadata edit fields to a single vertical column in the desktop Sheet instead of the previous 50/50 two-column layout.
- Validation: `git diff --check` and `npm run build`.
- Browser verification note: attempted local browser verification, but `agent-browser` was unavailable and the existing Next dev server lock/port did not respond from the sandbox.

## 2026-06-19 - Session detail header date label

- Updated `/team-sessions/[id]` header behavior in `components/site-header.tsx` so desktop breadcrumbs use the session date/time instead of the generic `Session` crumb.
- Updated the mobile `/team-sessions/[id]` header to show the same `MMM D HH:MM AM/PM` date/time label instead of `Team Sessions` and to include the mobile menu/sidebar trigger.
- Added a `12:00 AM` fallback when a session has no `Dock Out` time, so the header still keeps the requested date/time shape.
- Extended `/api/team-sessions/[id]/breadcrumb` to return `session_date` and `dock_out_at` for the shared header.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session standard move quick create persistence

- Updated `/team-sessions/[id]` Standard Moves read-only card to render linked Std. Moves as badges with shadcn tooltip details: hover/focus on desktop and tap on mobile.
- Fixed the Std. Move badge tooltip open state so desktop/mobile interaction stays controlled and does not trigger React controlled/uncontrolled warnings.
- Updated `/team-sessions/[id]` Standard Moves Info edit in `features/sessions/session-detail-tabs-client.tsx` so closing Quick Create Std. Move discards typed name/description and no longer leaves a pending `Will create and link` placeholder.
- Added immediate Std. Move creation with a `Create` button, disabled/pending spinner state, and automatic selection of the created move in the current edit draft before the final session `Save`.
- Kept the edit Drawer/Sheet open after quick-create by removing the nested quick-create form submit from inside the main session info form.
- Added `createSessionStandardMoveAction` in `features/sessions/actions.ts` and removed save-time quick-create fields from `updateSessionInfoInputSchema`, so `Save` only persists selected `standardMoveId` links.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session standard moves edit layout

- Updated `/team-sessions/[id]` Standard Moves Info edit in `features/sessions/session-detail-tabs-client.tsx` so the Std. Moves selector fills the available vertical content area.
- Replaced the native multi-select helper with a searchable checkbox list and removed the Cmd/Ctrl selection instruction.
- Changed Standard Moves so each move row is its own collapsible accordion item: the list shows checkbox + title, descriptions expand per move, and opening one closes the other.
- Removed the forced dark background from the Standard Moves checkbox list container.
- Moved Quick Create Std. Move out of the scrolleable content and into a fixed panel directly above the save footer for both mobile Drawer and desktop Sheet layouts.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Optimistic session info saves and bottom toasts

- Updated `/team-sessions/[id]` Info edits in `features/sessions/session-detail-tabs-client.tsx` with optimistic card updates, rollback on failed saves, and server snapshot reconciliation for Standard Moves and Wind Patterns.
- Added a result-returning session info save action in `features/sessions/actions.ts` while keeping the existing redirecting action as the fallback.
- Mounted the shadcn/Sonner toaster at bottom center and switched the session detail page from top inline save feedback to toast-only feedback.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-19 - Session coaching note corrector

- Updated `/team-sessions/[id]` Info edit in `features/sessions/session-detail-tabs-client.tsx` with a local Correct action for `Best` and `To Work`.
- Added native spelling/autocorrect/autocapitalize support plus deterministic cleanup for capitalization, spacing, common typos, contractions, and sailing acronyms.
- Kept the form-status and correction controls as stable components so typing in edit textareas does not remount the input and drop focus.
- Validation: `npm run lint`, `git diff --check`, and `npm run build`.

## 2026-06-10 - Password sign-in pending state

- Updated `/sign-in` password submit action in `app/sign-in/sign-in-content.tsx` so the button label is `Sign In`.
- Added a disabled pending state with a spinner on the password sign-in button while `/auth/password` processes and redirects to the next page.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-09 - Root auth-transition loading state

- Replaced the root `app/loading.tsx` fallback with a centered, theme-aware Sailog spinner for refresh/re-entry and auth transition states.
- Added `RootTransitionLoading` in `components/shared/page-skeletons.tsx` using theme tokens so dark mode is respected.
- Kept route-specific skeletons unchanged for `/sign-in`, `/onboarding`, and authenticated app pages.
- Validation: `git diff --check` and `npm run build`.

## 2026-06-09 - Rollback sidebar/dropdown regression

- Reverted commit `b52f4b0b288d0c1799e9d15acd057f6717aee1d6` after it broke the desktop sidebar Team/Org switcher and user dropdown.
- Restored the previous sidebar/dropdown behavior by undoing the mobile session UI and feedback-flow commit as a new revert commit.
- Validation: `npm run build` and `git diff --check` run before publish.

## Current Snapshot

Sailog has completed bootstrap + Milestone 1 auth foundation:

- Next.js App Router + TypeScript + Tailwind + ESLint configured
- Supabase project linked (`gumxfgsvqnhrwgzwnuem`)
- Initial schema migration in repo and applied
- Vercel connected to GitHub and production deploy fixed
- Environment variables managed in Vercel (not in GitHub)
- Local development running with `.env.local`
- Phase 6 kickoff started with first vertical slice: `venues` CRUD
- Magic-link redirect origin fix deployed for production auth emails

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
- Added `NEXT_PUBLIC_APP_URL` in Production as `https://sailog.vercel.app`

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

## Magic Link Redirect Fix Completed

- Root cause addressed: email links were sometimes generated with localhost origin.
- OTP route now resolves callback origin in this order:
  1. `NEXT_PUBLIC_APP_URL`
  2. request `Origin` header
  3. forwarded host/proto headers
  4. request URL origin fallback
- Updated files:
  - `app/auth/otp/route.ts`
  - `lib/supabase/env.ts`
  - `.env.example`
  - `README.md`
- Production redeploy executed after setting `NEXT_PUBLIC_APP_URL`.

## Git Status

- Milestone + Phase 6 kickoff commit pushed:
  - `82f81ba feat: milestone 1 auth, protected shell, baseline RLS, and venues CRUD kickoff`
- Follow-up docs sync commit pushed:
  - `1a9559c docs: refresh progress status after milestone push`
- Magic-link redirect fix commit pushed:
  - `fca6296 fix: stabilize magic-link redirect origin`
- Branch is synced:
  - `main...origin/main`

## Immediate Next Step

1. Continue Phase 6 with `team_venue_seasons` CRUD slice.

Suggested commit message:

`feat: add team_venue_seasons CRUD vertical slice`

Then verify in production:

1. OTP login email delivery
2. Magic-link callback returns to `https://sailog.vercel.app` (not localhost)
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
