# Team Home Audit

Date: 2026-07-12

Scope: current `/team-home` implementation, centered on
`app/(app)/team-home/page.tsx`, `features/team-home/data.ts`, and the shared
route loading skeleton.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`
- Reference list audits: `AUDIT_TEAM_CAMP.MD` and `AUDIT_TEAM_VENUE.MD`
- Cross-route speed plan: `CORE_USER_PAGES_FEELS_FAST_PLAN.md`

## Snapshot Register

### Foto actual

- Team Home is the canonical landing surface for team-scoped roles after
  sign-in.
- The page is a server component. It resolves authenticated access first, then
  resolves navigation scope from the active org/team search params.
- Missing organization scope and missing team scope render inline warning
  panels instead of attempting to load team data.
- When an active team exists, the route starts the dashboard data promises after
  scope resolution, then streams them through nested server `Suspense`
  boundaries:
  - `getTeamHomeLatestSessions({ limit: 5 })`
  - `getTeamHomeLatestCamps({ limit: 5 })`
  - `getTeamHomeLatestVenues({ limit: 5 })`
  - `getTeamHomeTeamMembers()`
  - `getTeamHomeKpis()`
- The final UI shows four KPI cards, Latest Sessions, Latest Camps, Latest
  Venues, a static sailing-class card, and Team Members.
- The route-level `loading.tsx` renders `TeamHomePageSkeleton`, which mirrors
  the current dashboard section skeletons for cold direct entry.
- The shared app header owns the visible page title and shows the active team
  name on `/team-home`, so the route does not duplicate a page-level H1.
- The route now emits `team_home_timing` logs for scope and each dashboard data
  section.
- KPI totals prefer a database-side aggregate RPC instead of loading every
  relevant camp/session row in application code. If the Supabase schema cache
  does not know the RPC yet, Team Home falls back to the previous row-based
  calculation so the dashboard does not crash while the migration is pending.
- The route has nested server `Suspense` splits for KPI cards, latest activity,
  venues, and roster sections. It does not yet have section-level retry.

### Current speed verdict

The perceived loading is decent today. The dashboard is not doing client-side
overfetching, and the main server reads are parallelized after scope is known.
The skeleton also gives a useful cold-load shape.

The main issue is not immediate visual polish. The latest Sessions and Camps
sections now use dedicated summary loaders instead of full list-route loaders,
KPI totals now prefer an aggregate RPC with a targeted migration-bridge fallback,
and the visible dashboard sections now sit behind nested server streaming
boundaries. The remaining performance pressure is live proof: the Step 3
migration must be applied to the target database and the `team_home_timing`
phases should be compared on realistic team data.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.4/5 | Fast enough for current data because the route runs the dashboard reads in parallel, has a mirrored route skeleton, logs per-section timing, uses bounded Team Home summary loaders for latest Sessions and Camps, computes KPI totals through one aggregate RPC when available, and now streams dashboard sections behind nested boundaries. Remaining pressure is applying the KPI migration in every target database and capturing live timing proof. |
| UI consistency | 4.4/5 | The dashboard uses the shared `GradientCard` visual language and the header is owned by app chrome. The header now names the active team on Team Home, the card layout is clear on desktop and compact on mobile, route-level and section skeletons mirror the visible KPI, latest activity, venues, and roster areas, mobile `View All` actions now meet the 44px target, and roster roles read as badges instead of disabled buttons. |
| Code tidiness | 3.8/5 | The route is understandable, typed, and server-first, with section components now separated inside `page.tsx`. `features/team-home/data.ts` still carries unused mock-data types and fixtures beside live data helpers, and the route file remains large enough that a future extraction to `features/team-home/` would be reasonable. |
| Scalability | 4.0/5 | Latest Sessions and Camps no longer pay for exact counts, page metadata, mutation chrome, or visible-camp session counts. KPIs no longer fetch all relevant camp IDs and session `net_time_minutes` rows into application code once the aggregate RPC exists in the target database. The temporary schema-cache fallback still uses the old row path only to avoid a hard runtime failure while the migration is pending. |
| Best practices | 4.3/5 | Auth, scope, server-first reads, typed helpers, scoped links, route-level loading, Team Home timing logs, dedicated latest-item query contracts, aggregate-oriented KPI contracts, and nested dashboard streaming are solid. Missing piece versus mature Sailog routes is local section retry. |
| Modularity | 3.7/5 | Team Home has a small feature data module and route-local section components for KPI cards, latest activity, venues, sailing class, and roster. This is enough for the current screen, but further dashboard growth should move the section components under `features/team-home/`. |
| Security | 4.4/5 | The route requires authenticated access and resolves scoped org/team state before data reads. Data access remains RLS/server-backed. Remaining security work is indirect: if dedicated Team Home API slices are added later, they must repeat the same auth, org, team, and membership checks instead of trusting client scope. |

Overall: 4.3/5. Team Home feels reasonably fast now and has the same basic
server streaming posture as the mature Team Sessions, Team Camps, and Team
Venues work. The next improvement should be live timing comparison after
applying the KPI RPC migration, then local retry only if real failures justify
it.

## Current Architecture

Entry points:

- `app/(app)/team-home/page.tsx`
- `app/(app)/team-home/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/team-home/timing.ts`
- `features/team-home/data.ts`
- `features/venues/navigation.ts`
- `features/camps/navigation.ts`
- `features/sessions/navigation.ts`
- `components/site-header.tsx`

Data behavior:

- `requireAuthenticatedAccessContext()` runs before route content.
- `resolveNavigationScope()` chooses the active organization and team from the
  URL scope params and authenticated context.
- If `navigation.scope` is missing, the page returns a warning panel.
- If `scope.activeTeamId` is null, the page returns a team-selection warning.
- With an active team, the route starts all visible dashboard section promises
  together, but the page renders them through nested `Suspense` boundaries.
- Latest Sessions are sourced through `getTeamHomeLatestSessions()`, which
  reads scoped team venue IDs, camp IDs/names, the latest five sessions, and
  venue names for only the visible session rows.
- Latest Camps are sourced through `getTeamHomeLatestCamps()`, which reads
  scoped team venue IDs, the latest five camps, and venue names for only those
  visible camps.
- Latest Venues use a Team Home specific helper and are already limited to
  five team venue links.
- Team Members load all active team memberships, then fetch matching profiles.
- KPIs call `get_team_home_kpi_totals`, which returns total camps, total
  sessions, summed net time minutes, and average net time minutes from the
  database. If Supabase returns the known missing-RPC schema-cache error, the
  helper logs `team_home_kpi_totals_rpc_missing_fallback` and computes the same
  labels through the previous row-based path.
- `features/team-home/timing.ts` logs `team_home_timing` for `scope`,
  `latest_sessions`, `latest_camps`, `latest_venues`, `team_members`, and
  `kpis`.

UI behavior:

- On `/team-home`, the shared app header title resolves to the active team name.
- KPI cards render as a two-column mobile grid and four-column desktop grid.
- KPI cards, latest activity, latest venues, and roster each have their own
  section skeleton fallback.
- Latest Sessions, Camps, and Venues render as dashboard list cards with scoped
  links to their full routes and details.
- Current Camp and Venue badges are derived from whether today's UTC date falls
  inside one of the visible camp date ranges.
- The sailing-class card is static until a team sailing-class model exists.
- Team Members render as a simple roster list with avatars and role badges.

## Loading Patterns Comparison

Matches:

- The route has `app/(app)/team-home/loading.tsx`.
- The loading state uses `TeamHomePageSkeleton`.
- The route-level skeleton mirrors the streamed KPI, latest activity, venues,
  sailing-card, and roster skeleton shapes instead of showing a separate old
  page-title placeholder first.
- Auth and scope are resolved server-side before scoped data is read.
- Data reads are parallelized after scope resolution.
- The route emits per-section timing logs so the next data-contract change can
  be based on real slow-section evidence.
- Latest Sessions and Camps now use bounded Team Home summary loaders instead
  of full list-route loaders.
- KPI totals now prefer a database-side aggregate RPC, with a targeted fallback
  only for the missing-RPC schema-cache state.
- KPI cards, latest activity, venues, and roster now stream through nested
  server `Suspense` boundaries while the route-level skeleton remains available
  for direct cold entry.

Gaps:

- There is no section-level retry. A failure in one dashboard helper can
  collapse the full page response.
- The route does not use cache-first warm navigation from
  `CORE_USER_PAGES_FEELS_FAST_PLAN.md`, and Team Home is not listed in that
  current plan.

## Mobile UI Standards Comparison

Matches:

- The dashboard avoids desktop tables on mobile.
- Cards are compact and stacked naturally.
- Row links have enough vertical padding to be tappable in normal data states.
- Empty states remain inside the relevant card section.
- Mobile `View All` actions render as `h-11` footer links so they do not crowd
  card titles.
- Team Members role labels use compact badge styling instead of button variants.
- Mobile now gets the same section skeletons as desktop once the route shell is
  available. A direct cold route entry still uses the full-page skeleton first.

Gaps:

- The route-level full-page skeleton is intentionally broad and does not mirror
  every mobile footer action detail.

## Desktop UI Standards Comparison

Matches:

- Desktop app chrome owns the route title.
- The layout uses dense dashboard cards rather than forcing an operational
  table pattern onto a home surface.
- Cards keep short factual labels and avoid extra instructional copy.
- Scoped links preserve org/team context for full list and detail navigation.

Gaps:

- The card sections now render as route-local server components behind nested
  `Suspense` boundaries.
- There is no hover/focus prefetch on dashboard detail links. This is not
  critical, but the list routes already use prefetch for common detail
  navigation.

## Data And Performance Risks

1. Live before/after timing comparison is still operational.
   The `team_home_timing` phases are in place, and the KPI aggregate RPC is now
   implemented. The before/after comparison must be captured against realistic
   team data after the migration is applied to the target database. Until that
   migration exists in the running Supabase project, the route uses the
   row-based fallback to avoid crashing.

2. Latest Sessions still needs all camp IDs for the team.
   This is much lighter than the previous full list-loader path, but a very
   large team could still benefit from a database-side scoped latest-sessions
   query or RPC.

3. Roster is unbounded.
   Loading all active memberships is probably fine for normal sailing teams.
   If organizations later support large support staffs, the roster card should
   limit visible members and link to Members.

4. Failure isolation is still coarse.
   The route now streams section loading independently, but there is no local
   section retry/error boundary yet. A thrown dashboard helper can still bubble
   to the route-level error surface.

## Recommended Change Order

### Step 1 - Add Team Home timing logs

Status: implemented on 2026-07-12 through
`features/team-home/timing.ts` and wrappers in `app/(app)/team-home/page.tsx`.

The route now logs these phases:

- `scope`
- `latest_sessions`
- `latest_camps`
- `latest_venues`
- `team_members`
- `kpis`

This came first because the current experience is already decent. The goal is
to identify the real slow section before changing architecture.

### Step 2 - Replace broad list loaders with Team Home summary loaders

Status: implemented on 2026-07-12 through dedicated helpers in
`features/team-home/data.ts`:

- `getTeamHomeLatestSessions({ activeTeamId, limit: 5 })`
- `getTeamHomeLatestCamps({ activeTeamId, limit: 5 })`

These return only the fields Team Home renders and avoid:

- exact list counts;
- page count metadata;
- mutation/create option chrome;
- session counts that Team Home does not display.

This was the highest-value performance change because it kept the UI exactly
the same while removing summary-page overfetch.

### Step 3 - Make KPIs aggregate-oriented

Status: implemented on 2026-07-12 through
`supabase/migrations/038_team_home_kpi_totals.sql`,
`getTeamHomeKpis()`, and the generated database function type.

The four current KPI labels are unchanged, but Team Home no longer fetches every
session row when team data grows. The database-side RPC returns:

- total camps;
- total sessions;
- sum of net time minutes;
- average net time minutes.

The Server Component can keep formatting the returned numbers.

Live timing note: this code change removes the row-based KPI scale weakness once
the migration is applied. A targeted row-based fallback remains for the known
missing-RPC schema-cache error so the app stays usable during rollout. The
actual before/after `team_home_timing` comparison should be captured after the
migration is applied to the target database and an authenticated `/team-home`
request is run against realistic team data.

### Step 4 - Split slow dashboard sections only if timing proves it

Status: implemented on 2026-07-12 as a conservative structural split after the
Step 4 request. The route now keeps auth/scope and static chrome stable, starts
all section promises in parallel, and renders nested deferred sections for:

- KPI cards boundary;
- latest activity boundary;
- venues boundary;
- roster boundary.

The current route-level `TeamHomePageSkeleton` is still used for direct cold
entry. Section skeletons are only inside the dashboard after the route shell is
available.

Measurement note: the split is implemented, but the original timing-proof
condition is still pending live verification because the Step 3 RPC migration
must be applied to the database used by the app before collecting realistic
before/after `team_home_timing` logs.

### Step 5 - Mobile action polish

Status: implemented on 2026-07-12 in `app/(app)/team-home/page.tsx`.

Mobile card actions now match the 44px standard:

- `View All` actions stay compact in card headers on desktop.
- On mobile, `View All` actions move to card footers and render as full-width
  `h-11` links.
- Team Members role labels use badge styling instead of `buttonVariants()`.
- The dashboard keeps the same compact card density.

## What Not To Change Yet

- Do not redesign Team Home into a table/list route. It is a dashboard landing
  surface, and the current card composition is appropriate.
- Do not add client cache-first behavior unless timing proves it is needed. The
  current route is already acceptable, and narrower server data contracts are
  simpler than adding warm-cache complexity.
- Do not move auth, scope, or membership checks into client code.
- Do not make the static sailing-class card dynamic until there is a real team
  sailing-class model.

## Next Engineering Priority

Apply the Step 3 migration, capture live timings, then add local retry only if
the logs or real failures justify it:

1. Apply `038_team_home_kpi_totals.sql` to the target database.
2. Confirm the fallback warning `team_home_kpi_totals_rpc_missing_fallback` no
   longer appears.
3. Run an authenticated `/team-home` request on realistic team data.
4. Compare `team_home_timing` logs for `kpis` before and after the aggregate
   RPC path.
5. If a section fails independently often enough, add a local retry/error
   boundary for that section.

Expected result: Team Home keeps its current "pretty decent" feel, with the KPI
scale weakness removed before it becomes visible to users.

## Validation

Step 1, Step 2, Step 3, Step 4, and Step 5 implementation validation:

- `npm run lint`
- `./node_modules/.bin/tsc --noEmit`
- `npm run build`
- `git diff --check -- app/(app)/team-home/page.tsx features/team-home/data.ts features/team-home/timing.ts types/database.ts supabase/migrations/038_team_home_kpi_totals.sql AUDIT_TEAM_HOME.MD`
- direct trailing-whitespace scan for `AUDIT_TEAM_HOME.MD` and
  `features/team-home/timing.ts`, because new untracked files are not covered by
  `git diff --check` until staged.
- Live `team_home_timing` before/after comparison remains pending until the new
  RPC migration is applied to the database used by the app.
