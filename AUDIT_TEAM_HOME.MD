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
- When an active team exists, the route loads the main dashboard payload in one
  `Promise.all()`:
  - `getTeamSessionsPageData({ page: 1 })`
  - `getTeamCampsPageData({ page: 1 })`
  - `getTeamHomeLatestVenues({ limit: 5 })`
  - `getTeamHomeTeamMembers()`
  - `getTeamHomeKpis()`
- The final UI shows four KPI cards, Latest Sessions, Latest Camps, Latest
  Venues, a static sailing-class card, and Team Members.
- The route-level `loading.tsx` renders `TeamHomePageSkeleton`, which mirrors
  the current dashboard shape closely enough for cold direct entry.
- The shared app header owns the visible `Team Home` title, so the route does
  not duplicate a page-level H1.
- The route currently has no nested `Suspense` split, no section-level retry,
  no Team Home timing logs, and no dedicated lightweight latest-items loader.

### Current speed verdict

The perceived loading is decent today. The dashboard is not doing client-side
overfetching, and the main server reads are parallelized after scope is known.
The skeleton also gives a useful cold-load shape.

The main issue is not immediate visual polish. It is that Team Home borrows
full list-route loaders for a summary dashboard. That means the home page can
pay for list chrome, exact counts, pagination metadata, session-count reads,
and larger page sizes even though it only renders five sessions and five camps.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 3.9/5 | Fast enough for current data because the route runs the dashboard reads in parallel and has a mirrored route skeleton. The weakness is payload shape: Team Home uses full Sessions/Camps page loaders, exact counts, and KPI reads that scale with all team venues, camps, and sessions. The slowest dashboard query blocks the whole page body. |
| UI consistency | 4.0/5 | The dashboard uses the shared `GradientCard` visual language and the header is owned by app chrome. The card layout is clear on desktop and compact on mobile. Remaining gaps are mostly mobile control sizing on small `View All` actions and the lack of section-level loading states if one area is slow. |
| Code tidiness | 3.6/5 | The route is understandable, typed, and server-first, but `page.tsx` owns a lot of formatting, link building, UI rendering, and local summary logic. `features/team-home/data.ts` still carries unused mock-data types and fixtures beside live data helpers. |
| Scalability | 3.2/5 | Latest sessions and camps are bounded only after full list loaders return. Camps load up to 25 rows before slicing to five; Sessions load 10 before slicing to five. KPIs fetch all relevant camp IDs and all session `net_time_minutes` rows to compute totals in application code. This is acceptable for small teams but will become the first Team Home bottleneck. |
| Best practices | 3.8/5 | Auth, scope, server-first reads, typed helpers, scoped links, and route-level loading are solid. Missing pieces versus mature Sailog routes are split dashboard sections, local retry, instrumentation, and dedicated small query contracts for summary cards. |
| Modularity | 3.3/5 | Team Home has a small feature data module, but the route reuses unrelated list-page data contracts and keeps most presentation pieces inline. There is no `TeamHomeRouteShell` or section component split yet. That is fine while the screen is simple, but not if more dashboard modules are added. |
| Security | 4.4/5 | The route requires authenticated access and resolves scoped org/team state before data reads. Data access remains RLS/server-backed. Remaining security work is indirect: if dedicated Team Home API slices are added later, they must repeat the same auth, org, team, and membership checks instead of trusting client scope. |

Overall: 3.8/5. Team Home feels reasonably fast now, but it is not yet on the
same loading architecture level as the mature Team Sessions, Team Camps, and
Team Venues list routes. The next improvement should be narrow data contracts,
not a visual redesign.

## Current Architecture

Entry points:

- `app/(app)/team-home/page.tsx`
- `app/(app)/team-home/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/team-home/data.ts`
- `features/sessions/data.ts`
- `features/camps/data.ts`
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
- With an active team, the route loads all visible dashboard sections together.
- Latest Sessions are sourced through `getTeamSessionsPageData()` and then
  sliced to five rows.
- Latest Camps are sourced through `getTeamCampsPageData()` and then sliced to
  five rows.
- Latest Venues use a Team Home specific helper and are already limited to
  five team venue links.
- Team Members load all active team memberships, then fetch matching profiles.
- KPIs load all team venues, all camps under those team venues, then all session
  `net_time_minutes` rows for those camps to compute totals and averages.

UI behavior:

- The shared app header renders `Team Home` for this pathname.
- KPI cards render as a two-column mobile grid and four-column desktop grid.
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
- The skeleton broadly mirrors the KPI, list-card, sailing-card, and roster
  layout.
- Auth and scope are resolved server-side before scoped data is read.
- Data reads are parallelized after scope resolution.

Gaps:

- The whole route body waits for the slowest dashboard data promise.
- There is no nested `Suspense` boundary for KPI, latest activity, venues, or
  roster sections.
- There is no section-level retry. A failure in one dashboard helper can
  collapse the full page response.
- There is no Team Home specific timing log to identify the slow section.
- The route does not use cache-first warm navigation from
  `CORE_USER_PAGES_FEELS_FAST_PLAN.md`, and Team Home is not listed in that
  current plan.

## Mobile UI Standards Comparison

Matches:

- The dashboard avoids desktop tables on mobile.
- Cards are compact and stacked naturally.
- Row links have enough vertical padding to be tappable in normal data states.
- Empty states remain inside the relevant card section.

Gaps:

- The `View All` links use small outline button sizing inside card headers.
  For strict mobile parity, these should become `h-11` touch targets or move to
  a mobile-friendly card footer/action row.
- The Team Members role badge is styled with button variants even though it is
  not interactive. This is visually acceptable but can read like a disabled
  action.
- There is no mobile-specific loading split for slow sections. A cold load uses
  the full-page skeleton until all dashboard data is ready.

## Desktop UI Standards Comparison

Matches:

- Desktop app chrome owns the route title.
- The layout uses dense dashboard cards rather than forcing an operational
  table pattern onto a home surface.
- Cards keep short factual labels and avoid extra instructional copy.
- Scoped links preserve org/team context for full list and detail navigation.

Gaps:

- The card sections are all rendered by one large server component, so there is
  no mounted shell plus deferred result area like the mature list routes.
- There is no hover/focus prefetch on dashboard detail links. This is not
  critical, but the list routes already use prefetch for common detail
  navigation.

## Data And Performance Risks

1. Reused Sessions loader overfetches for Team Home.
   `getTeamSessionsPageData()` loads Sessions chrome, counts matching sessions,
   resolves pagination, loads up to `TEAM_SESSIONS_PAGE_SIZE` rows, and returns
   metadata. Team Home only uses the first five session rows.

2. Reused Camps loader overfetches for Team Home.
   `getTeamCampsPageData()` loads Camps chrome, exact counts, up to
   `TEAM_CAMPS_PAGE_SIZE` rows, and session counts for visible camps. Team Home
   only renders the first five camp rows and does not display session counts.

3. KPI aggregation is row-based.
   `getTeamHomeKpis()` loads all team venue IDs, all matching camp IDs, and all
   session net-time values. This is simple and correct, but it is the likely
   long-term scale bottleneck.

4. Roster is unbounded.
   Loading all active memberships is probably fine for normal sailing teams.
   If organizations later support large support staffs, the roster card should
   limit visible members and link to Members.

5. Failure isolation is coarse.
   Because the dashboard payload is assembled before render, a single failed
   helper can prevent otherwise healthy cards from rendering.

## Recommended Change Order

### Step 1 - Add Team Home timing logs

Add a small `features/team-home/list-timing.ts` or `features/team-home/timing.ts`
with phases for:

- `scope`
- `latest_sessions`
- `latest_camps`
- `latest_venues`
- `team_members`
- `kpis`

This should come first because the current experience is already decent. The
goal is to identify the real slow section before changing architecture.

### Step 2 - Replace broad list loaders with Team Home summary loaders

Add dedicated helpers in `features/team-home/data.ts`:

- `getTeamHomeLatestSessions({ activeTeamId, limit: 5 })`
- `getTeamHomeLatestCamps({ activeTeamId, limit: 5 })`

These should return only the fields Team Home renders and should avoid:

- exact list counts;
- page count metadata;
- mutation/create option chrome;
- session counts that Team Home does not display.

This is the highest-value performance change because it keeps the UI exactly
the same while removing summary-page overfetch.

### Step 3 - Make KPIs aggregate-oriented

Keep the four current KPI labels, but stop fetching every session row when team
data grows. Prefer a database-side aggregate through an RPC or narrowly scoped
query contract that returns:

- total camps;
- total sessions;
- sum of net time minutes;
- average net time minutes.

The Server Component can keep formatting the returned numbers.

### Step 4 - Split slow dashboard sections only if timing proves it

If timing logs show one section blocks the route, split Team Home into stable
server chrome plus nested deferred sections:

- KPI cards boundary;
- latest activity boundary;
- venues boundary;
- roster boundary.

Keep the current route-level `TeamHomePageSkeleton` for direct cold entry. Use
section skeletons inside the dashboard only when one section is demonstrably
slower than the rest.

### Step 5 - Mobile action polish

If Team Home gets a UI pass, make mobile card actions match the 44px standard:

- promote `View All` actions to `h-11` on mobile, or place them in a card
  footer where the larger target does not crowd the title;
- keep role badges visually badge-like instead of button-like;
- preserve the current compact dashboard density.

## What Not To Change Yet

- Do not redesign Team Home into a table/list route. It is a dashboard landing
  surface, and the current card composition is appropriate.
- Do not add client cache-first behavior before Step 1 and Step 2. The current
  route is already acceptable, and narrower server data contracts are simpler
  than adding warm-cache complexity.
- Do not move auth, scope, or membership checks into client code.
- Do not make the static sailing-class card dynamic until there is a real team
  sailing-class model.

## Next Engineering Priority

Implement Step 1 and Step 2 together:

1. Add Team Home timing instrumentation around the current five dashboard
   reads.
2. Add dedicated latest Sessions and latest Camps summary helpers.
3. Update `app/(app)/team-home/page.tsx` to use the summary helpers instead of
   `getTeamSessionsPageData()` and `getTeamCampsPageData()`.
4. Keep the UI unchanged.
5. Validate with typecheck/build and compare timing logs before and after.

Expected result: Team Home keeps its current "pretty decent" feel, but removes
the main scale weakness before it becomes visible to users.

## Validation

Audit-only change in this pass. Required validation for the markdown artifact:

- `git diff --check -- AUDIT_TEAM_HOME.MD`
- direct trailing-whitespace scan, because new untracked docs are not covered
  by `git diff --check` until staged.
