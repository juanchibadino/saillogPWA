# Team Camp ID Audit

Date: 2026-06-28

Scope: current `/team-camps/[id]` implementation, centered on
`app/(app)/team-camps/[id]/page.tsx` and the supporting Camp detail modules.

Pattern documents reviewed:

- `MOBILE_UI_PATTERNS.md`
- `MOBILE_CARD_LIST_UI.md`
- `DESKTOP_UI_PATTERNS.md`
- Reference audit shape: `AUDIT_TEAM_SESSION_ID.MD`

This audit started as a current-state assessment and was updated after Step 5
landed on 2026-06-28.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance | 4.0/5 | The page is server-first and has a route skeleton. The initial route now loads camp/venue context, KPI metrics, and only the selected tab payload. Inactive tabs load through a scoped tab-data route. Sessions uses the existing server-paginated Team Sessions list loader, Notes loads bounded session chunks, and route/action timing logs now split shell, selected tab, notes, and Goals save phases. |
| UI consistency | 3.8/5 | Header, tabs, and empty states are usable. Goals editing uses desktop Sheet plus mobile Drawer with fixed footer and visible save pending state. Camp summary KPIs match the Team Session ID gradient-card pattern, and Sessions now renders through the shared desktop table/mobile cards surface. |
| Code tidiness | 3.6/5 | The route page is small and server-first, the Goals edit surface has been extracted from `CampDetailTabsClient`, and `detail-data.ts` now separates shell, Sessions, Goals, Notes, and tab dispatch loading. Route-state normalization and Goals save redirect behavior now live in a focused pure helper with tests. |
| Scalability | 3.5/5 | Initial render no longer scales with every tab payload. Sessions is bounded by the existing server page size, inactive tab requests are scoped and deferred, and Notes now loads incrementally through bounded session chunks. Remaining scale work is mostly KPI aggregation and focused route tests. |
| Best practices | 3.8/5 | Auth, scope resolution, Zod-backed server actions, route loading/error boundaries, RLS-backed server reads/writes, Goals save pending feedback, focused route-state tests, and structured timing logs are in place. The main remaining best-practice gap is URL-synced tab/page transitions after client interaction. |
| Modularity | 2.9/5 | The implementation has typed data and navigation helpers, and Goals edit UI is now separated. Camp detail is still not decomposed like Team Session ID because Sessions, Notes, and pagination remain in one client module. |
| Security | 4.4/5 | The page requires authenticated access and active scope. Data loading validates camp -> team venue -> active team and venue -> active organization. Goals updates recheck `canManageTeamStructure()` and camp scope before writing. Remaining security work is mostly around keeping any new deferred API routes equally scoped. |

Overall: 3.7/5. The route is functional and server-first, but it is still an
early Camp detail implementation compared with the newer Team Session ID
standard. The biggest gaps are KPI aggregation, URL-backed tab state after
client interaction, and row detail prefetch.

## Current Route Shape

Entry points:

- `app/(app)/team-camps/[id]/page.tsx`
- `app/(app)/team-camps/[id]/loading.tsx`
- `app/(app)/team-camps/[id]/error.tsx`
- `components/shared/page-skeletons.tsx`
- `features/camps/detail-data.ts`
- `features/camps/detail-route-state.mjs`
- `features/camps/detail-route-state.test.mjs`
- `features/camps/detail-timing.ts`
- `features/camps/camp-detail-tabs-client.tsx`
- `features/camps/detail/camp-goals-edit-surface.tsx`
- `features/camps/actions.ts`
- `features/camps/navigation.ts`
- `features/camps/detail-types.ts`
- Shared mobile header behavior in `components/site-header.tsx`

Page behavior:

- `page.tsx` requires authenticated access, resolves navigation scope, rejects
  missing organization/team scope, loads lightweight Camp/venue chrome through
  `getCampDetailChromeData()`, and defers KPI aggregation plus the selected tab
  payload behind `Suspense`.
- The route accepts `tab` and `page` search params, but those values are only
  used as initial client state. Later tab changes and session page changes do
  not update the URL.
- The Camp title and venue/camp-type context render above `CampsFeedback` and
  the client tab surface.
- `loading.tsx` uses `CampDetailPageSkeleton`.

Data behavior:

- `getCampDetailChromeData()` loads the camp, then its team venue, then venue
  for the header chrome. `getCampDetailKpisData()` separately loads only KPI
  session metrics for the summary cards.
- `getCampDetailTabData()` dispatches the selected tab payload only:
  Sessions uses the existing server-paginated Team Sessions list loader, Goals
  loads camp notes, and Notes loads one bounded camp-session chunk plus only the
  setup/review/move/wind-pattern context required for that chunk.
- `team_camp_timing` logs now record `load_chrome`, `load_kpis`, `load_tab`,
  and `load_notes` phases with outcome metadata and relevant counts.
- `/api/team-camps/[id]/tab-data` rechecks authenticated access, active
  navigation scope, active team, active organization, and camp/team-venue scope
  through the same shell loader before returning inactive tab data.

Client behavior:

- `CampDetailTabsClient` renders KPI cards and owns lazy tab state for Sessions,
  Goals, and Notes.
- Route-level and deferred Camp skeletons now mirror the final mobile/desktop
  surfaces: KPI card/grid, Camp tabs, Sessions toolbar/cards/FAB, desktop
  table/pagination, Goals panel, and Notes cards.
- The initial client state contains only the selected tab payload.
- Inactive tabs are fetched on demand from `/api/team-camps/[id]/tab-data`.
- Per-tab request versions prevent stale tab responses from overwriting newer
  tab state.
- Sessions renders through the shared Team Sessions table/cards component with
  server-returned page data from the selected tab payload.
- Goals editing uses `CampGoalsEditSurface`, which renders a mobile Drawer and
  desktop right Sheet with fixed header/footer, disabled pending state, and
  `Save` / `Saving...` submit feedback.
- Camp summary KPIs use `GradientCard`: one mobile card with divided rows and a
  desktop grid of gradient cards, matching Team Session ID summary cards.
- Camp date ranges render in abbreviated form, for example
  `Mar 25 - Mar 29 2026`.
- Notes render as local cards for every session that has notes/review/move/wind
  content in the loaded chunks.
- Notes uses `Load more notes` to incrementally append the next bounded session
  chunk while preserving existing field labels.

Security behavior:

- The page requires authenticated context before loading.
- Data loading checks the active team through `team_venues.team_id` and active
  organization through `venues.organization_id`.
- `updateCampGoalsAction()` validates form input, checks
  `canManageTeamStructure()`, verifies camp scope, updates `camps.notes`, and
  redirects back to the Camp detail route through the tested redirect helper.
- Goals saves emit `team_camp_timing` logs with the `save_camp_goals` phase.

## UI Standards Comparison

### Mobile UI Standards

Matches:

- The route uses the phase-one mobile app header for `/team-camps`.
- The detail route falls back to `/team-camps` when the mobile back button is
  used from `/team-camps/[id]`.
- The route has a dedicated loading skeleton.
- Goals editing now uses the current mobile Drawer pattern with fixed
  header/footer and one scrollable form body.
- The mobile Save CTA uses `h-11 w-full`, disables while pending, and shows
  spinner plus `Saving...`.
- The Goals textarea uses keyboard-safe focus scrolling inside the Drawer body.
- Camp summary KPIs now follow the Team Session ID mobile pattern: one gradient
  card with rows.
- Camp detail tabs now use full-width mobile tab sizing with equal-width
  triggers, while desktop tabs remain compact.

Gaps:

- The remaining mobile UI gap is URL-backed tab state after client tab changes.

### Mobile Card List Patterns

Matches:

- Sessions are tappable and navigate to Team Session detail.
- Sessions render as mobile cards behind the shared Team Sessions responsive
  surface.
- Mobile uses the full-width `Load more sessions` control with visible loading
  feedback when more pages are accumulated.
- Mobile card navigation keeps local pending affordance from the shared sessions
  table/cards component.
- Notes are rendered as repeated cards and keep text fields scannable.
- Notes loads incrementally with a full-width `Load more notes` button.
- Empty states are concise.

Gaps:

- Camp tab changes are still local client state instead of URL-backed tab
  transitions.
- Notes pagination is session-chunk based, not a true notes-card count.

### Desktop Table Patterns

Matches:

- The route page is server-first for auth, scope, permissions, and initial data.
- Desktop uses compact UI and real links for session navigation.
- The Sessions tab renders the shared desktop table with stable headers and
  server-returned page metadata.
- Desktop pagination uses route links with pending affordance from the shared
  table component.

Gaps:

- Row detail prefetch on hover/focus is not present.

## Remaining Risks

1. The shell KPI summary still reads camp session metrics for every session,
   although it no longer carries full session rows or tab payloads.
2. Notes pagination is currently based on scanned session chunks, so a chunk
   can return no note cards when those sessions have no note content.
3. The Sessions tab still lacks row detail prefetch on hover/focus.
4. Tab/page state is initialized from the URL but not kept in the URL after
   client interactions, so refresh/back/share behavior can drift from what the
   operator is seeing.
5. Focused route-state and Goals redirect tests are in place, but the deferred
   tab-data API still lacks integration coverage around authenticated scope
   failures.

## Next Engineering Priority

Step 1: Fix the Goals edit surface.

- Status: implemented 2026-06-28 in
  `features/camps/detail/camp-goals-edit-surface.tsx`.
- Extracted the Goals edit UI out of `CampDetailTabsClient`.
- Replaced the old all-viewport Dialog with desktop right Sheet and mobile
  bottom Drawer.
- Kept header and footer fixed, with one scrollable form body.
- Added `Save` / `Saving...`, disabled fieldset, disabled submit button, and a
  spinner while pending.
- Added mobile `h-11 w-full` Save sizing and keyboard-safe textarea focus
  behavior.
- Preserved the existing `updateCampGoalsAction`, scope hidden inputs,
  validation, and redirect behavior.

Step 2: Split Camp detail data by selected tab.

- Status: implemented 2026-06-28 in
  `features/camps/detail-data.ts`,
  `app/(app)/team-camps/[id]/page.tsx`,
  `app/api/team-camps/[id]/tab-data/route.ts`, and
  `features/camps/camp-detail-tabs-client.tsx`.
- Kept the initial route shell to camp/venue context, KPI summary, and the
  selected tab payload.
- Added scoped `/api/team-camps/[id]/tab-data` loading for inactive tabs.
- Preserved active org/team/camp checks by routing the API through the same
  shell loader used by the page.
- Added per-tab request-version protection in the client so stale responses do
  not overwrite newer tab state.

Step 3: Align the Sessions tab with list/table standards.

- Status: implemented 2026-06-28 through the shared
  `features/sessions/sessions-table.tsx` surface.
- Desktop renders a stable table with server page size 10, server page count,
  URL-backed page links, and disabled/pending pagination states.
- Mobile renders compact cards behind `md:hidden`, uses accumulated
  `Load more sessions`, keeps existing cards visible, and puts pending state in
  the button/card-list surface.
- Scope and `tab=sessions` are preserved in generated camp-detail hrefs.
- Remaining refinement: add detail prefetch on hover/focus where practical.

Step 4: Bound the Notes tab.

- Status: implemented 2026-06-28 in
  `features/camps/detail-data.ts`,
  `app/api/team-camps/[id]/tab-data/route.ts`,
  `features/camps/detail-types.ts`, and
  `features/camps/camp-detail-tabs-client.tsx`.
- Notes cards are not built during initial route render unless Notes is the
  selected tab.
- Notes tab data reads one bounded camp-session chunk at a time, then only the
  setup/review/standard-move/wind-pattern rows for that chunk.
- The client appends additional chunks through `Load more notes`, with pending
  feedback and stale-response protection.
- Existing note field labels are unchanged: `Free Notes`, `Best`, `To Work`,
  `Standard Moves`, and `Wind Pattern`.

Step 5: Add route-level resilience and focused tests.

- Status: implemented 2026-06-28 in
  `app/(app)/team-camps/[id]/error.tsx`,
  `features/camps/detail-route-state.mjs`,
  `features/camps/detail-route-state.test.mjs`,
  `features/camps/detail-timing.ts`,
  `features/camps/detail-data.ts`,
  `features/camps/actions.ts`, and
  `app/(app)/team-camps/[id]/page.tsx`.
- Added a scoped route error boundary with a local `Retry` surface.
- Added pure route-state tests for tab/page/notes-offset normalization and
  detail redirect preservation.
- Added Goals save redirect tests for invalid input, forbidden scope, missing
  camp, successful save, and missing required scope fallback.
- Added `team_camp_timing` logs for `load_shell`, `load_tab`, `load_notes`, and
  `save_camp_goals` phases so later performance work can use real phase data.
- The page now uses the shared route-state helper for initial tab/page/Notes
  offset normalization.

## Validation

- Step 2 implementation validation passed with `npm run lint`, `git diff
  --check`, `npm run build`, and `npm test`. Full lint still reports the two
  unrelated existing unused-var warnings in `app/sign-in/sign-in-content.tsx`
  and `features/onboarding/onboarding-flow.tsx`.
- Step 4 implementation validation passed with `npm run lint`, `git diff
  --check`, `npm run build`, and `npm test`. Full lint still reports the same
  two unrelated existing unused-var warnings.
- Step 5 implementation validation passed with `npm run lint`, `npm run build`,
  `npm test`, and `git diff --check`. Full lint still reports the same two
  unrelated existing unused-var warnings.
- Audit source review completed against:
  - `app/(app)/team-camps/[id]/page.tsx`
  - `features/camps/camp-detail-tabs-client.tsx`
  - `features/camps/detail-data.ts`
  - `app/api/team-camps/[id]/tab-data/route.ts`
  - `features/camps/actions.ts`
  - `components/shared/page-skeletons.tsx`
  - `components/site-header.tsx`
  - `MOBILE_UI_PATTERNS.md`
  - `MOBILE_CARD_LIST_UI.md`
  - `TABLE_DESKTOP_PATTERNS_UI.md`
- Initial audit runtime validation was not run because that pass was
  documentation-only.
- Step 1 implementation validation:
  - `./node_modules/.bin/tsc --noEmit`: passes.
  - `npm run lint`: passes with 0 errors and the existing unrelated warnings in
    `app/sign-in/sign-in-content.tsx` and
    `features/onboarding/onboarding-flow.tsx`.
  - `git diff --check`: passes.
  - Direct trailing-whitespace scan for the new Camp Goals edit file,
    `AUDIT_TEAM_CAMP_ID.MD`, and `PROGRESS.md`: passes.
  - `npm run build`: passes and confirms `/team-camps/[id]` remains dynamic.
- Summary-card/date-format validation:
  - `./node_modules/.bin/tsc --noEmit`: passes.
  - `npm run lint`: passes with the same unrelated warnings listed above.
  - `git diff --check`: passes.
  - Direct trailing-whitespace scan for touched Camp files,
    `AUDIT_TEAM_CAMP_ID.MD`, and `PROGRESS.md`: passes.
  - `npm run build`: passes.
  - Local formatter smoke confirms `2026-03-25` to `2026-03-29` renders as
    `Mar 25 - Mar 29 2026`.
