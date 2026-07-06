# Team Camps List Audit

Date: 2026-07-04

Scope: current `/team-camps` list implementation, centered on
`app/(app)/team-camps/page.tsx` and the supporting Camp list modules.

This audit is separate from `AUDIT_TEAM_CAMP_ID.MD`, which tracks the
`/team-camps/[id]` detail route.

Refresh 2026-07-04: this is a post-implementation audit after Steps 1, 2, and
3 were completed for the `/team-camps` list route. The route now follows the
current Team Sessions list standard: stable chrome, split chrome/results data,
results-only `Suspense`, desktop Sheet, mobile Drawer, local transition
feedback, count-backed pagination, and focused route-state tests.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`
- Reference list audit shape: `AUDIT_TEAM_SESSION.MD`

## Snapshot Register

### Foto actual

Current state after the list-route loading and UI parity work:

- The page is server-first and requires authenticated access plus navigation
  scope before rendering the list surface.
- Auth/scope feedback and read-only warnings render outside the list data
  boundary, so operator feedback is not hidden behind slow camp data.
- The route splits chrome from results:
  - `getTeamCampsChromeData()` loads venue/filter/create chrome.
  - `getTeamCampsResultsData()` loads rows, `pageCount`, and pagination state.
  - `TeamCampsRouteShell` keeps title, filters, desktop New, mobile FAB, and
    transition overlays mounted.
  - `TeamCampsResultsSkeleton` is used inside the results-only `Suspense`
    boundary.
- The route-level skeleton is composed from chrome and results skeleton pieces,
  matching the final mobile FAB/filter shape, mobile cards, desktop table, and
  pagination placeholders.
- Desktop renders a camps table with Venue, Type, Status filters, active filter
  clear buttons, count-backed numbered pagination, row prefetch, and a local
  table overlay during page transitions.
- Mobile renders tappable camp cards with local navigation spinner, a single
  fixed `mobile-floating-action size-14` New action, a bottom filter Drawer, and
  full-width `Load more camps` accumulation.
- Create and edit use desktop right Sheet and mobile bottom Drawer, with fixed
  header/footer, one scrollable body, disabled fieldsets, and pending submit
  buttons.
- Delete uses the blurred destructive modal treatment with pending `Deleting...`
  feedback.
- Create/update/delete redirects preserve Venue, Type, Status, and page state.
- List timing logs now emit `team_camps_list_timing` phases for `scope`,
  `filters`, `camps`, and `session_counts`.
- Focused route-state tests cover page normalization, `loadMore`, Type/Status
  filters, page href preservation, and create/update/delete redirect
  preservation.

### Target state

Most of the original target is now implemented. The remaining target is
hardening and measurement rather than broad UI reconstruction:

- Measure `team_camps_list_timing` on realistic data and decide whether exact
  counts, venue catalog loading, or session count reads need a heavier
  optimization.
- Add a local route-level error/retry surface for results failures so one
  failed results payload does not collapse the full route experience.
- Add focused browser/manual coverage for create/edit/delete Sheet/Drawer flows
  on mobile and desktop.
- Add direct mutation permission/ownership regression tests if the repo gets a
  stable server-action/Supabase test harness.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.4/5 | The route now resolves auth/scope first, streams chrome and results separately, keeps feedback outside slow boundaries, page-bounds camp rows, supports mobile accumulation, emits list timing phases, and only counts sessions for visible camps. Remaining pressure points are exact count queries, full team venue/venue catalog reads on each render, and session counts loaded as rows rather than aggregate counts. |
| UI consistency | 4.5/5 | The list now matches the accepted Team Sessions pattern: desktop table, mobile cards, mounted chrome, filter Drawer, desktop Sheet, mobile Drawer, mobile FAB, full-width mobile load-more, local overlays, row/card spinner, and pending save/delete buttons. Remaining polish is mostly interaction verification across real devices and authenticated data states. |
| Code tidiness | 4.2/5 | The route now delegates route state, timing, chrome/results data, shell, toolbar, table/cards, navigation helpers, forms, and actions to separate modules. Remaining cleanup opportunities are reducing the large camp form module and moving some inline shell option construction into a helper when it starts to repeat. |
| Scalability | 4.1/5 | Camps now have count-backed pagination, page-bounded data, mobile accumulated loading, filtered count queries, and per-phase timing logs. Remaining scale concerns are exact `count: "exact"` cost, repeated catalog reads, and session-count reads that may become expensive for camps with very high session volume. |
| Best practices | 4.4/5 | The route uses server-first access checks, Server Actions with Zod-backed inputs, RLS-backed writes, nested `Suspense`, route skeletons, `useTransition`, `useFormStatus()`, disabled fieldsets, accessible filter controls, and focused route-state tests. Remaining gap is a results-level error/retry path. |
| Modularity | 4.2/5 | Camps list is now decomposed close to Sessions list: `TeamCampsRouteShell`, `TeamCampsToolbar`, `TeamCampsTable`, `list-route-state.mjs`, `list-timing.ts`, and split data loaders. The form surface is still intentionally consolidated in one module, which is acceptable but now the largest local component. |
| Security | 4.5/5 | Create/update/delete recheck authenticated context, org/team scope, capabilities, billing entitlement for creates, camp/team-venue ownership, and redirect state on the server. Tests cover redirect preservation; remaining risk is direct mutation permission coverage around forbidden/ownership failures. |

Overall: 4.3/5. The `/team-camps` list has moved from a functional
server-first list to a route that substantially matches the current Sailog list
standard. The remaining work is measurement, failure hardening, and regression
coverage rather than core UX parity.

## Current Architecture

Entry points:

- `app/(app)/team-camps/page.tsx`
- `app/(app)/team-camps/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `components/site-header.tsx`
- `features/camps/data.ts`
- `features/camps/camps-table.tsx`
- `features/camps/camp-form-dialogs.tsx`
- `features/camps/actions.ts`
- `features/camps/navigation.ts`
- `features/camps/list-route-state.mjs`
- `features/camps/list-route-state.test.mjs`
- `features/camps/list-timing.ts`
- `features/camps/team-camps-route-shell.tsx`
- `features/camps/team-camps-toolbar.tsx`

Data behavior:

- The page requires authenticated access and active navigation scope.
- Search params are normalized through `resolveTeamCampsListRequest()`.
- `venue` is normalized against allowed venue IDs.
- `type` accepts `training`, `regatta`, or `mixed`.
- `campStatus` accepts `active` or `inactive` to avoid colliding with action
  feedback `status`.
- Auth, scope, capability checks, feedback, and warnings render before the list
  data boundary.
- Chrome data loads team venues, venue catalog, venue filter options, selected
  filters, and create-form venue options.
- Results data loads the filtered count, clamps `currentPage`, derives
  `pageCount`, loads the visible page or accumulated mobile range, then loads
  session counts only for visible camps.
- Timing logs cover scope, filters, camps, and session-count phases.

UI behavior:

- Desktop renders table rows with row-level detail navigation, link prefetch on
  hover/focus, numbered pagination, ellipses, active page state, and a centered
  table overlay during page transitions.
- Mobile renders compact tappable cards, action menu isolation, local detail
  navigation spinner, and accumulated `Load more camps`.
- Filters are Venue, Type, and Status.
- Desktop filters use dropdowns with active styling and clear buttons.
- Mobile filters use a bottom Drawer with `h-11` controls and fixed footer
  actions.
- Create/edit use desktop right Sheet and mobile bottom Drawer.
- Form fields disable while pending; submit buttons expose spinner labels.
- Delete uses a destructive Dialog with blurred overlay and pending button.

Header behavior:

- `/team-camps` uses the shared phase-one mobile header.
- Mobile back on the list route goes directly to scoped Team Home with
  `Go to Team Home`.
- Detail breadcrumb behavior remains tracked separately in
  `AUDIT_TEAM_CAMP_ID.MD`.

## Loading Patterns Comparison

Matches:

- Segment-level `loading.tsx` renders `TeamCampsPageSkeleton`.
- The skeleton is composed from `TeamCampsChromeSkeleton` and
  `TeamCampsResultsSkeleton`.
- The page resolves auth/scope and warnings before the heavy list data.
- Stable chrome stays mounted while results load.
- Results load behind a nested `Suspense` boundary.
- Filter/page transitions dim the current table/cards and show one centered
  spinner.
- Mobile load-more has button-level pending feedback.
- Row/card navigation has local spinner feedback and prefetch.
- Save/create/delete buttons expose pending feedback.

Remaining gaps:

- There is no local results error boundary/retry surface yet.
- There is no automated visual coverage for the Sheet/Drawer states yet.
- Performance tuning still needs real timing samples after this implementation.

## Mobile UI Standards Comparison

Matches:

- Mobile list uses cards instead of table rows.
- Cards are tappable and keyboard accessible.
- Nested action menus stop click/key propagation.
- The filter surface is a bottom Drawer.
- Filter controls are `h-11`.
- New uses the single fixed `mobile-floating-action size-14` FAB.
- Create/edit use bottom Drawers with fixed footer actions.
- Save/create/delete flows have visible pending states.
- Card navigation and load-more actions show local loading feedback.

Remaining gaps:

- Authenticated mobile browser verification still needs to cover real create,
  edit, delete, filter, and load-more paths.
- If the camp form grows, the mobile Drawer form should be split into smaller
  field groups rather than growing the current shared module further.

## Desktop UI Standards Comparison

Matches:

- Desktop uses a table.
- Filters live in the toolbar.
- Active filters expose a right-side clear `X`.
- Row actions live in the right-aligned action column.
- Empty state lives inside the table body.
- Visible row labels are real links.
- Detail routes are prefetched on hover/focus.
- Pagination is numbered and exposes active page state.
- Page transitions dim/disable the table with one centered loading overlay.
- Create/edit use right Sheet surfaces.

Remaining gaps:

- The route still lacks a local results retry surface.
- Real-world timing will decide whether desktop count queries need a lighter
  strategy.

## Team Sessions Loading Pattern Cross-check

`/team-camps` is now aligned with the Team Sessions list-route reference:

- Camps has the same route-level skeleton composition pattern.
- Camps has the same chrome/results split.
- Camps has a mounted route shell for title, filters, desktop New, mobile FAB,
  and transition overlays.
- Camps has a results-only nested `Suspense` fallback.
- Camps has desktop numbered pagination and mobile accumulation.
- Camps has local filter/page/navigation feedback.
- Camps emits list timing logs.
- Camps create/edit surfaces now follow the current Sheet/Drawer form standard.

Remaining difference: Team Camps has a heavier venue/team-venue catalog
dependency for both filtering and camp creation, so measurement should verify
whether that chrome payload stays cheap enough as a team grows.

## Current Risks

1. Exact filtered count queries may become the slowest part of the route on
   large camp sets.
2. Chrome data still reloads the team venue and venue catalog on every render;
   this may be acceptable now but should be validated with timing logs.
3. Session counts are derived from visible session rows, not an aggregate count
   endpoint or RPC; high-session camps could expose that cost.
4. Results failures currently rely on the segment-level failure behavior rather
   than a local retry UI for the results area.
5. Server Action permission and ownership coverage is still indirect through
   route-state/redirect tests rather than direct mutation tests.
6. Sheet/Drawer interactions passed build-level validation, but authenticated
   browser coverage should still exercise real create/edit/delete flows.

## Next Engineering Priority

Step 4: Hardening and measurement pass.

- Capture `team_camps_list_timing` samples on realistic data for scope,
  filters, camps, and session_counts.
- Decide from timing whether to optimize exact counts, venue catalog loading,
  or session count aggregation.
- Add a results-level error/retry surface around the nested results boundary.
- Add authenticated manual/browser coverage for:
  - desktop create/edit Sheet
  - mobile create/edit Drawer
  - destructive delete pending state
  - filter transitions
  - mobile `Load more camps`
- Add direct Server Action permission/ownership tests if the repo introduces a
  stable Supabase test harness.

## Completed Engineering Steps

Step 1: Fix Camp list header and loading shell.

- Status: completed 2026-07-04.
- `/team-camps` mobile header now matches the accepted `/team-sessions` list
  behavior: direct scoped Team Home navigation and `Go to Team Home` label.
- Camps list data is split into `getTeamCampsChromeData()` for venue/filter/create
  chrome and `getTeamCampsResultsData()` for rows, `pageCount`, and pagination.
- `TeamCampsRouteShell` keeps title, filters, desktop New, mobile FAB, and
  pending overlays mounted while results load.
- `TeamCampsPageSkeleton` now uses reusable chrome/results pieces that mirror
  the final Camps list surface: mobile title/filter/FAB shape, cards, desktop
  toolbar/table headers, and pagination placeholders.
- The route uses a results-only `Suspense` fallback after chrome resolves,
  instead of wrapping the full toolbar/FAB/table surface in one list data
  boundary.
- List timing now emits scope, filters/catalog, camps page, and session count
  phases through `team_camps_list_timing`.

Step 2: Bring Camp list table/cards to the Sessions loading standard.

- Status: completed 2026-07-04.
- Added route-state normalization and tests for page, `loadMore`, Type, and
  Status filters in `features/camps/list-route-state.mjs`.
- Added count-backed desktop `pageCount` with numbered pagination.
- Added mobile accumulated `Load more camps`.
- Added `useTransition` handling for filter/page/load-more/navigation states.
- Current rows/cards stay visible while dimmed/disabled and show one local
  spinner overlay during filter/page transitions.
- Camp detail rows/cards prefetch on hover/focus and show a local navigation
  spinner.
- Added Venue, Type, and Status filters; the Status filter uses `campStatus`
  query params to avoid colliding with action feedback `status`.

Step 3: Replace Camp Dialog forms with responsive Sheet/Drawer surfaces.

- Status: completed 2026-07-04.
- Camp create/edit now use a desktop right Sheet and mobile bottom Drawer.
- Create/edit surfaces keep a fixed header/footer and one scrollable form body.
- Form fields are disabled while pending, and submit buttons use
  `useFormStatus()` with `Create camp` / `Creating...`, `Save` / `Saving...`,
  and `Delete` / `Deleting...` labels.
- Mobile create stays on the single `mobile-floating-action size-14` FAB.
- Delete confirm uses the blurred destructive modal treatment already accepted
  on Team Sessions.
- Create/update/delete redirects now preserve Venue, Type, Status, and page
  state after action completion or failure.
- Focused tests cover filter/page normalization plus create/update/delete
  redirect preservation.

## Validation

- Audit source review completed against:
  - `app/(app)/team-camps/page.tsx`
  - `app/(app)/team-camps/loading.tsx`
  - `components/shared/page-skeletons.tsx`
  - `components/site-header.tsx`
  - `features/camps/actions.ts`
  - `features/camps/camp-form-dialogs.tsx`
  - `features/camps/camps-table.tsx`
  - `features/camps/data.ts`
  - `features/camps/list-route-state.mjs`
  - `features/camps/list-route-state.test.mjs`
  - `features/camps/list-timing.ts`
  - `features/camps/navigation.ts`
  - `features/camps/team-camps-route-shell.tsx`
  - `features/camps/team-camps-toolbar.tsx`
  - `features/sessions/team-sessions-route-shell.tsx`
  - `features/sessions/sessions-table.tsx`
  - `LOADING_PATTERNS.md`
  - `MOBILE_UI_PATTERNS.md`
  - `DESKTOP_UI_PATTERNS.md`
- Implementation validation already run for the completed changes:
  - `npm test`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm run lint` (passes with the existing warnings in
    `app/sign-in/sign-in-content.tsx` and `features/onboarding/onboarding-flow.tsx`)
  - `npm run build`
  - Browser smoke on `http://127.0.0.1:3000/team-camps`: page loads, auth
    redirect renders sign-in, no framework overlay, no console errors.
- Documentation validation for this audit refresh:
  - `git diff --check`
  - direct trailing-whitespace scan on `AUDIT_TEAM_CAMP.MD`
