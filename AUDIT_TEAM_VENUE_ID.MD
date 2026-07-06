# Team Venue ID Audit

Date: 2026-07-06

Scope: current Team Venue detail implementation. The locked semantic route
convention is `/venues/[teamVenueId]`. The current App Router segment is still
`app/(app)/venues/[id]`, but that `id` value is a `team_venues.id`, not a
standalone venue id and not `/team-venues/[id]`.

This audit is separate from `AUDIT_TEAM_VENUE.MD`, which tracks the
`/team-venues` list route.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`
- Reference detail audits: `AUDIT_TEAM_CAMP_ID.MD` and
  `AUDIT_TEAM_SESSION_ID.MD`
- Reference list audits for upstream context: `AUDIT_TEAM_CAMP.MD` and
  `AUDIT_TEAM_SESSION.MD`

## Snapshot Register

### Foto actual

- The detail route is `app/(app)/venues/[id]/page.tsx`; the semantic convention
  is `/venues/[teamVenueId]`.
- The route requires authenticated access, resolves navigation scope, parses
  initial `tab`, `year`, and Wind Pattern `statusFilter` query params, then
  loads venue/team-venue identity through `getTeamVenueDetailChromeData()`.
- KPI data and the selected-tab payload load behind `Suspense` through
  `getTeamVenueDetailKpisData()` and `getTeamVenueDetailTabData()`.
- Initial KPI and selected-tab server loads now share
  `getTeamVenueDetailYearContextData()` through one request-local promise.
- Inactive tabs load through `app/api/venues/[id]/tab-data/route.ts` with
  active org/team/team-venue checks.
- Route timing logs cover `load_chrome`, `load_kpis`, `load_tab`, and heavy tab
  families through `team_venue_timing`.
- `VenueDetailTabsClient` owns the visible detail shell, but tab/year/session
  page interactions are now URL-backed through `detail-route-state.mjs`.
- Camps, Reports, and Wind Patterns tab bodies are split into focused
  `features/venues/detail/*-panel.tsx` components.
- Sessions tab data is bounded on the server/API and renders through the shared
  Team Sessions table/card surface.
- The route has `loading.tsx` through `VenueDetailPageSkeleton`, and deferred
  KPI/tab loads use selected-tab skeletons shaped like the final tab surface.
- The route has `app/(app)/venues/[id]/error.tsx` for runtime recovery.
- Focused route-state coverage exists for Venue detail tab/year/page/loadMore
  normalization and URL builders.
- Focused action-rule coverage exists for Venue update redirect preservation,
  forbidden updates, stale team scope, and cross-organization update attempts.
- Shared server-action harness coverage exists for Venue update success,
  forbidden, stale team scope, cross-organization, and RLS-denied write paths.
- Desktop breadcrumbs load the venue name from
  `app/api/venues/[id]/breadcrumb/route.ts` and now link the parent breadcrumb
  to scoped Team Venues.
- The shared phase-one mobile header includes `/venues/[id]`, uses the venue
  name as the mobile title when available, and sends back navigation to scoped
  Team Venues.
- Edit Venue now uses `EditVenueDialog` as a compatibility export, but the
  implementation renders a desktop right Sheet and mobile bottom Drawer.
- Edit Venue keeps fixed header/footer chrome, one scrollable form body, `Save`
  / `Saving...`, spinner feedback, disabled submit, and disabled fieldset while
  pending.

### Target state

The target should be the current Team Camp ID and Team Session ID detail
standard:

- Explicitly document and preserve the route identity:
  `/venues/[teamVenueId]`.
- Mobile header included in the phase-one detail pattern, with back navigation
  to Team Venues.
- Desktop breadcrumb parent chain using real scoped labels.
- Split detail data into chrome, KPIs, and selected-tab payloads.
- Load inactive tabs through a scoped tab-data API.
- Keep route-level skeletons and deferred skeletons shaped like the final
  mobile and desktop UI.
- Add route-level error recovery.
- Keep tabs, year, and session page state URL-backed after interaction.
- Keep edit surfaces on desktop Sheet and mobile Drawer with fixed footer and
  pending submit state.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.1/5 | The route loads chrome first, then KPI data and the selected tab behind Suspense. KPI and selected-tab loads share one initial year context, inactive tabs fetch through `/api/venues/[id]/tab-data`, timing logs cover the split payloads, Sessions are bounded by page/loadMore, and the route has runtime recovery. |
| UI consistency | 4.4/5 | Mobile uses the single divided KPI card, split mobile/desktop tab lists, and a mobile `More` overflow control. Sessions render through the shared Team Sessions table/card surface, Camps now uses the same mobile card/list behavior, Edit Venue follows the desktop Sheet / mobile Drawer standard, and runtime errors have the same retry surface as Team Camp/Session detail. Remaining gap is mostly the simpler Reports surface. |
| Code tidiness | 4.2/5 | The route has explicit chrome, KPI, tab-data, shared year context, timing, API, route-state, action-core, action-rule, error-boundary, responsive edit-form, and focused Camps/Reports/Wind Patterns panel surfaces. The legacy monolithic `getVenueDetailPageData()` remains for compatibility. |
| Scalability | 4.0/5 | Heavy assessment/report/wind-pattern support rows are loaded only when selected, Sessions are page-bounded with mobile accumulation, route-level recovery is isolated to the detail segment, and initial KPI/tab loads no longer duplicate the lightweight year-context read. |
| Best practices | 4.5/5 | Auth and scope are server-first, route loading and error recovery exist, tab/year/page state is URL-backed, focused route-state/action-rule tests exist, server-action harness tests now exercise the Venue update action boundary, Suspense defers KPI/selected-tab data, timing logs are structured, and the edit form has pending submit semantics. |
| Modularity | 4.1/5 | The data layer has split functions, shared initial year context, timing, route state, action-core, and a shared Sessions surface. Camps, Reports, and Wind Patterns now live in focused panel modules; Assessments already has its own panel, while the shell still owns tab state, client fetch state, and Sessions toolbar composition. |
| Security | 4.5/5 | The read path validates authenticated access, active organization, active team, and team-venue ownership. Venue update now requires the submitted `teamVenueId`, active team scope, existing venue ownership, and organization-operation capability before writing, with action-rule and harness tests for forbidden/stale-scope/cross-organization/RLS-denied paths. RLS remains the database backstop. |

Overall: 4.6/5. Team Venue ID is functionally present, route/header identity is
locked, first render no longer pays for all heavy tab families, Sessions are
bounded, mobile detail UI follows the main KPI/tab standard, and Edit Venue now
uses the current responsive edit surface. Runtime recovery and direct-submit
ownership coverage are in place. Step 7 closes the shared server-action harness
and duplicate initial year-context gaps. The follow-up tab-loading and Camps
mobile card parity pass closes the known mobile loading/list gaps. Remaining
deltas are mostly live Supabase-backed RLS smoke coverage and the simpler
Reports surface.

## Current Architecture

Entry points:

- `app/(app)/venues/[id]/page.tsx`
- `app/(app)/venues/[id]/loading.tsx`
- `app/(app)/venues/[id]/error.tsx`
- `app/api/venues/[id]/breadcrumb/route.ts`
- `app/api/venues/[id]/tab-data/route.ts`
- `components/shared/page-skeletons.tsx`
- `components/site-header.tsx`
- `features/venues/detail-data.ts`
- `features/venues/detail-timing.ts`
- `features/venues/detail-route-state.mjs`
- `features/venues/detail-route-state.test.mjs`
- `features/venues/action-rules.mjs`
- `features/venues/action-rules.test.mjs`
- `features/venues/update-action-core.mjs`
- `features/venues/update-action-core.test.mjs`
- `features/venues/detail-types.ts`
- `features/venues/detail/camps-panel.tsx`
- `features/venues/detail/reports-panel.tsx`
- `features/venues/detail/wind-patterns-panel.tsx`
- `features/venues/venue-detail-tabs-client.tsx`
- `features/sessions/sessions-table.tsx`
- `features/sessions/team-sessions-toolbar.tsx`
- `features/venues/venue-form-dialogs.tsx`
- `features/venues/actions.ts`
- `features/venues/navigation.ts`
- `features/venues/venue-assessments-panel.tsx`
- `features/testing/server-action-harness.mjs`
- `features/wind-patterns/*`
- `features/reports/report-form-dialogs.tsx`

Data behavior:

- The page resolves auth and navigation scope before loading detail data.
- `tab=metrics` is normalized to `assessments`; unknown tabs fall back to
  `camps`.
- The `year` query param selects the initial KPI and selected-tab year.
- The route validates the requested `teamVenueId` by loading `team_venues` and
  comparing `teamVenue.team_id` to the active team.
- If no active team is selected, the route can still return venue identity but
  no team-scoped operational data.
- Chrome loads only venue/team-venue identity before the deferred content.
- KPI data loads selected-year camp/session metrics behind Suspense.
- The initial KPI and selected-tab loads share one
  `getTeamVenueDetailYearContextData()` promise for available years, camps, camp
  ids, selected year, and the request Supabase client.
- The selected tab loads only its own family. Camps load selected-year
  camp/session support rows; Sessions load a bounded selected-year page through
  shared Team Sessions row data; Reports load selected-year reports and
  report-camp links; Assessments load templates/runs/support rows only on the
  Assessments tab; Wind Patterns load only on the Wind Patterns tab.
- Inactive tabs load through `/api/venues/[id]/tab-data` and are cached by
  year/tab in the client.
- Sessions pagination is URL-backed and server/API bounded by `page` and
  mobile `loadMore=1`.

UI behavior:

- The detail UI starts in `VenueDetailTabsClient`.
- Year selection writes `year` and the current tab to the URL.
- Detail tab selection writes `tab` and the current year to the URL.
- KPIs render as one divided mobile `GradientCard` and a compact desktop grid.
- Camps render through `VenueCampsPanel` with a mobile card/list surface aligned
  to `TeamSessionsTable`, including prefetch, tappable cards, and per-item
  navigation spinner feedback.
- Sessions render through `TeamSessionsTable`, giving mobile cards, desktop
  table, shared action menus, shared toolbar filters, desktop pagination, and
  mobile Load more.
- Assessments render through `VenueAssessmentsPanel`.
- Wind Patterns render through `VenueWindPatternsPanel`, which owns the
  status-filter routing and Wind Patterns table/toolbar composition.
- Reports render local cards with PDF download links and a create-report
  dialog through `VenueReportsPanel` when allowed.
- Edit Venue appears as a responsive edit action in the detail header area.

Header behavior:

- Desktop breadcrumbs support `/venues/[id]` and fetch the venue name through
  `app/api/venues/[id]/breadcrumb/route.ts`.
- The desktop parent breadcrumb now links to scoped `/team-venues` with label
  `Team Venues`, matching the Team Venue parent convention.
- The phase-one mobile header includes `/venues/[id]`; its back action pushes to
  scoped `/team-venues`, and its title uses the venue name when the breadcrumb
  fetch resolves.
- The mobile bottom nav does mark `/venues/[id]` as part of Team Venues, so
  navigation identity is partially recognized.

Mutation behavior:

- `updateVenueAction()` validates form input, organization-operation
  capability, active team scope, team-venue ownership, and existing venue
  organization before updating.
- The edit form posts the route `teamVenueId` as hidden action input so direct
  submissions cannot update a venue outside the scoped team-venue identity.
- `updateVenueAction()` delegates to `runUpdateVenueAction()` so server-action
  tests can inject auth, Supabase, redirect, and revalidation dependencies.
- `features/testing/server-action-harness.mjs` can run actions with mocked
  dependencies or supplied real dependency functions while capturing redirects
  and revalidation paths consistently.
- The edit redirect preserves the selected tab and year on successful update or
  validation failure.
- The edit form exposes pending button state, spinner feedback, and disabled
  fieldset controls while saving.

## Loading Patterns Comparison

Matches:

- The route has `app/(app)/venues/[id]/loading.tsx`.
- `loading.tsx` uses `VenueDetailPageSkeleton`.
- The skeleton includes header, year chips, KPI cards, tabs, mobile `More`
  overflow, and selected-tab-shaped rows/cards.
- The route splits chrome from deferred KPI and selected-tab data.
- Inactive tabs are deferred through `/api/venues/[id]/tab-data`.
- Timing logs cover `load_chrome`, `load_kpis`, `load_tab`,
  `load_assessments`, `load_reports`, and `load_wind_patterns`.
- Deferred tab failures render a retry state in the client.

Gaps:

- No known tab-loading parity gap remains against the current Team Camp ID and
  Team Session ID detail patterns.

## Mobile UI Standards Comparison

Matches:

- The route has a mobile-capable layout and the single divided mobile KPI card.
- Detail tabs split mobile and desktop lists.
- Mobile detail tabs use the full-width `h-11` pattern with `More` overflow.
- Camps and Sessions use the shared mobile card/list interaction pattern:
  tappable cards, hover/focus prefetch, and per-item spinner feedback while
  navigating.
- Sessions use the shared mobile accumulated `Load more` pattern.
- The skeleton has a mobile-friendly high-level shape.
- `/venues/[id]` is included in the phase-one mobile header.
- Mobile back returns to scoped Team Venues.

Gaps:

- Reports still uses a simpler local mobile surface than Sessions.

## Desktop UI Standards Comparison

Matches:

- Desktop breadcrumbs exist and resolve the current venue name.
- The desktop parent breadcrumb says `Team Venues` and links to scoped
  `/team-venues`.
- Desktop uses compact tab and KPI layouts.
- Camps and Sessions use real row/card navigation.
- Sessions use the shared Team Sessions desktop table surface.
- Reports expose direct PDF download links.
- Heavy tab data is deferred behind desktop tab panels.

Gaps:

- Reports still uses a simpler local desktop surface than Sessions.

## Team Camp ID / Team Session ID Cross-check

Compared with `/team-camps/[id]` and `/team-sessions/[id]`, Team Venue ID is
still lighter in:

- Live Supabase-backed RLS smoke coverage when a shared environment is
  available.
- Reports panel parity with the richer shared Sessions surface.

## Current Risks

1. Switching to Assessments can still be expensive, but that cost is now paid
   only when the tab is selected.
2. The existing route path can be misunderstood as a global Venue ID when it is
   actually a Team Venue ID.
3. The new action harness covers RLS-denied writes through a mocked Supabase
   client; it does not yet prove the same path against a live Supabase/RLS test
   environment.
4. Reports is modular, but still uses a simpler local surface than the shared
   Sessions table/card UI.

## Completed Step

Step 1: Lock route identity and header behavior.

- Chosen convention: `/venues/[teamVenueId]`.
- Current implementation keeps the App Router `[id]` segment, but code treats it
  as `teamVenueDetailId` / `teamVenueId`.
- `/venues/[id]` is included in the phase-one mobile detail header.
- Mobile back returns to scoped Team Venues.
- Desktop parent breadcrumb label and href are `Team Venues` and scoped
  `/team-venues`.

Step 2: Split detail loading.

- Added `getTeamVenueDetailChromeData()` for venue/team-venue identity.
- Added `getTeamVenueDetailKpisData()` for selected-year KPI metrics.
- Added `getTeamVenueDetailTabData()` for the selected tab only.
- Added `app/api/venues/[id]/tab-data/route.ts` with the same active
  org/team/team-venue checks and `teamVenueId` naming internally.
- Added `team_venue_timing` logs for `load_chrome`, `load_kpis`, `load_tab`,
  `load_assessments`, `load_reports`, and `load_wind_patterns`.

Step 3: Align mobile and desktop detail UI.

- Added the single divided mobile KPI card pattern.
- Split mobile and desktop tab lists.
- Added `More` overflow for mobile tabs.
- Kept tab/year/page state in the URL after interaction.
- Replaced the local Sessions tab list with the shared Team Sessions
  table/card surface.
- Added `features/venues/detail-route-state.mjs` and focused route-state tests.
- Added `/venues/...` as an accepted Team Sessions action return path.

Step 4: Replace edit Dialog with responsive edit surface.

- Replaced the edit Dialog implementation with a desktop right Sheet.
- Added mobile bottom Drawer behavior.
- Kept fixed header/footer and one scrollable body.
- Added `Save` / `Saving...`, spinner, disabled submit, and disabled fieldset.
- Kept redirect preservation for tab/year.

Step 5: Add resilience and tests.

- Added `app/(app)/venues/[id]/error.tsx`.
- Added `features/venues/action-rules.mjs` for Venue update redirect and
  ownership decisions.
- Added redirect-preservation tests for Venue update, including selected tab and
  year.
- Added permission/ownership tests for forbidden, stale team scope, and
  cross-organization update attempts.
- Hardened `updateVenueAction()` to require `teamVenueId`, active team scope,
  matching team-venue ownership, and existing venue organization before update.

Step 6: Decompose remaining local panels and deepen integration coverage.

- Extracted Camps panel routing into `features/venues/detail/camps-panel.tsx`.
- Extracted Reports panel routing into `features/venues/detail/reports-panel.tsx`.
- Extracted Wind Patterns panel routing, status-filter hrefs, and status
  filtering into `features/venues/detail/wind-patterns-panel.tsx`.
- Identified the missing shared action-test harness, which Step 7 now closes.
- Identified duplicated lightweight year-context reads, which Step 7 now closes.

Step 7: Add action integration harness and share initial year context.

- Added a shared server-action/RLS integration harness that can mock or run
  `requireAuthenticatedAccessContext()`, `createServerSupabaseClient()`,
  `redirect()`, and `revalidatePath()` consistently.
- Used that harness to cover Venue update success, forbidden, stale team scope,
  cross-organization, and RLS-denied write paths.
- Added a shared initial year-context path for the KPI and selected-tab server
  loads without breaking the existing chrome/KPI/tab split or timing logs.

Follow-up: Tab loading and Camps mobile parity.

- Replaced the generic deferred Venue detail fallback with
  `VenueDetailDeferredContentSkeleton` and `VenueDetailPanelSkeleton`, so KPI
  and tab loading now mirror the selected tab instead of showing generic rows.
- Reused the same deferred skeleton from `app/(app)/venues/[id]/loading.tsx`,
  removing the brief initial generic header/year skeleton before the accurate
  Venue detail loading shape appears.
- Removed the global dimming behavior during tab/year navigation; the selected
  tab changes immediately and only the missing panel renders its local skeleton
  or retry state.
- Kept the selected tab title visible during loading; Camps now renders
  `Camps {year}` with the same mobile/desktop title sizes as Sessions and no
  subtitle.
- Kept mobile/desktop loaded panel wrapping split so Camps and Sessions are not
  double-wrapped in a parent card.
- Updated the Camps mobile list to match the Team Sessions mobile card/list
  interaction: `GradientCard`, tappable row, prefetch on hover/focus,
  keyboard activation, and per-card spinner while navigating.

## Next Engineering Priority

Optional hardening after this audit batch:

- Add a live Supabase-backed action/RLS smoke path when the repo has a stable
  shared test environment for it.
- Bring Reports visual density closer to the shared Sessions surface if that
  tab becomes a daily-use surface.

## Validation

- Audit source review completed against:
  - `app/(app)/venues/[id]/page.tsx`
  - `app/(app)/venues/[id]/loading.tsx`
  - `app/api/venues/[id]/breadcrumb/route.ts`
  - `components/shared/page-skeletons.tsx`
  - `components/site-header.tsx`
  - `features/venues/actions.ts`
  - `features/venues/detail-data.ts`
  - `features/venues/detail-timing.ts`
  - `features/venues/navigation.ts`
  - `features/venues/venue-detail-tabs-client.tsx`
  - `features/venues/venue-form-dialogs.tsx`
  - `LOADING_PATTERNS.md`
  - `MOBILE_UI_PATTERNS.md`
  - `DESKTOP_UI_PATTERNS.md`
  - `AUDIT_TEAM_CAMP_ID.MD`
  - `AUDIT_TEAM_SESSION_ID.MD`
- Code validation after the header and audit update:
  - `npm run lint -- components/site-header.tsx`
  - `git diff --check -- components/site-header.tsx`
  - `rg -n '[ \t]$' AUDIT_TEAM_VENUE_ID.MD components/site-header.tsx`
- Step 2 validation:
  - `npm run lint -- 'app/(app)/venues/[id]/page.tsx' 'app/api/venues/[id]/tab-data/route.ts' features/venues/detail-data.ts features/venues/detail-types.ts features/venues/detail-timing.ts features/venues/venue-detail-tabs-client.tsx`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `git diff --check`
- Step 3 validation:
  - `npm run lint -- 'app/(app)/venues/[id]/page.tsx' 'app/api/venues/[id]/tab-data/route.ts' features/venues/detail-data.ts features/venues/detail-types.ts features/venues/venue-detail-tabs-client.tsx features/venues/detail-route-state.mjs features/venues/detail-route-state.test.mjs features/sessions/list-route-state.mjs features/sessions/list-route-state.test.mjs`
  - `node --test features/venues/detail-route-state.test.mjs features/sessions/list-route-state.test.mjs`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `git diff --check`
  - `rg -n '[ \t]$' AUDIT_TEAM_VENUE_ID.MD 'app/(app)/venues/[id]/page.tsx' 'app/api/venues/[id]/tab-data/route.ts' features/venues/detail-data.ts features/venues/detail-types.ts features/venues/detail-route-state.mjs features/venues/detail-route-state.test.mjs features/venues/venue-detail-tabs-client.tsx features/sessions/list-route-state.mjs features/sessions/list-route-state.test.mjs package.json`
- Step 4 validation:
  - `npm run lint -- features/venues/venue-form-dialogs.tsx 'app/(app)/venues/[id]/page.tsx' features/venues/venue-detail-tabs-client.tsx`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `git diff --check`
  - `rg -n '[ \t]$' AUDIT_TEAM_VENUE_ID.MD features/venues/venue-form-dialogs.tsx 'app/(app)/venues/[id]/page.tsx' features/venues/venue-detail-tabs-client.tsx`
- Step 5 validation:
  - `node --test features/venues/action-rules.test.mjs`
  - `npm run lint -- 'app/(app)/venues/[id]/error.tsx' 'app/(app)/venues/[id]/page.tsx' features/venues/actions.ts features/venues/venue-form-dialogs.tsx features/venues/action-rules.mjs features/venues/action-rules.test.mjs lib/validation/venues.ts`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `git diff --check`
  - `rg -n '[ \t]$' AUDIT_TEAM_VENUE_ID.MD 'app/(app)/venues/[id]/error.tsx' 'app/(app)/venues/[id]/page.tsx' features/venues/actions.ts features/venues/action-rules.mjs features/venues/action-rules.test.mjs features/venues/venue-form-dialogs.tsx lib/validation/venues.ts package.json`
- Step 6 validation:
  - `npm run lint -- features/venues/venue-detail-tabs-client.tsx features/venues/detail/camps-panel.tsx features/venues/detail/reports-panel.tsx features/venues/detail/wind-patterns-panel.tsx`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `git diff --check`
  - `rg -n '[ \t]$' AUDIT_TEAM_VENUE_ID.MD features/venues/venue-detail-tabs-client.tsx features/venues/detail/camps-panel.tsx features/venues/detail/reports-panel.tsx features/venues/detail/wind-patterns-panel.tsx`
- Step 7 validation:
  - `node --test features/venues/update-action-core.test.mjs`
  - `npm run lint -- features/testing/server-action-harness.mjs features/venues/update-action-core.mjs features/venues/update-action-core.test.mjs features/venues/actions.ts lib/auth/capability-rules.mjs lib/auth/capability-rules.test.mjs lib/auth/capabilities.ts lib/auth/capability-rules.d.mts features/venues/detail-data.ts 'app/(app)/venues/[id]/page.tsx' 'app/api/venues/[id]/tab-data/route.ts'`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
  - `rg -n '[ \t]$' AUDIT_TEAM_VENUE_ID.MD features/testing/server-action-harness.mjs features/venues/update-action-core.mjs features/venues/update-action-core.test.mjs features/venues/actions.ts lib/auth/capability-rules.mjs lib/auth/capability-rules.test.mjs lib/auth/capabilities.ts lib/auth/capability-rules.d.mts features/venues/detail-data.ts 'app/(app)/venues/[id]/page.tsx' 'app/api/venues/[id]/tab-data/route.ts' package.json`
- Follow-up validation:
  - `npm run lint -- components/shared/page-skeletons.tsx features/venues/venue-detail-tabs-client.tsx features/venues/detail/camps-panel.tsx 'app/(app)/venues/[id]/page.tsx'`
  - `./node_modules/.bin/tsc --noEmit --pretty false`
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
