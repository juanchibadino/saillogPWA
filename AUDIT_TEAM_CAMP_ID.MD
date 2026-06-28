# Team Camp ID Audit

Date: 2026-06-28

Scope: current `/team-camps/[id]` implementation, centered on
`app/(app)/team-camps/[id]/page.tsx` and the supporting Camp detail modules.

Pattern documents reviewed:

- `MOBILE_UI_PATTERNS.md`
- `MOBILE_CARD_LIST_UI.md`
- `TABLE_DESKTOP_PATTERNS_UI.md`
- Reference audit shape: `AUDIT_TEAM_SESSION_ID.MD`

This audit started as a current-state assessment and was updated after Step 1
landed on 2026-06-28.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance | 2.8/5 | The page is server-first and has a route skeleton, but the Camp detail data path loads every session in the camp, then loads setup, review, standard move, and wind pattern rows for every loaded session before first render. The visible Sessions tab paginates in the client with `slice()`, so page size does not reduce query cost or payload size. Selected tab only affects client state, not server payload. |
| UI consistency | 3.4/5 | Header, tabs, and empty states are usable. Goals editing now uses desktop Sheet plus mobile Drawer with fixed footer and visible save pending state, and the Camp summary KPIs now match the Team Session ID gradient-card pattern with one mobile card of rows. The Sessions tab still does not follow the current desktop-table/mobile-card split, and mobile still uses dense numbered pagination instead of the documented `Load more` card-list pattern. |
| Code tidiness | 3.2/5 | The route page is small and server-first, and the Goals edit surface has been extracted from `CampDetailTabsClient`. The tab client still owns tab state, session pagination, and Notes rendering, while `detail-data.ts` still mixes shell loading, KPI derivation, sessions, notes aggregation, and related catalog-name lookups. |
| Scalability | 2.4/5 | The current design scales with total camp session count, not with the visible page. Notes aggregation also grows with all sessions, setup rows, reviews, moves, and wind patterns. There is no tab-level deferral, bounded notes page, server page count, or incremental mobile loading. |
| Best practices | 3.4/5 | Auth, scope resolution, Zod-backed server actions, route loading skeletons, RLS-backed server reads/writes, and Goals save pending feedback are in place. Missing pieces are route-level `error.tsx`, URL-synced tab/page transitions, table/card loading states, focused tests, and structured timing logs. |
| Modularity | 2.9/5 | The implementation has typed data and navigation helpers, and Goals edit UI is now separated. Camp detail is still not decomposed like Team Session ID because Sessions, Notes, and pagination remain in one client module. |
| Security | 4.4/5 | The page requires authenticated access and active scope. Data loading validates camp -> team venue -> active team and venue -> active organization. Goals updates recheck `canManageTeamStructure()` and camp scope before writing. Remaining security work is mostly around keeping any new deferred API routes equally scoped. |

Overall: 3.3/5. The route is functional and server-first, but it is still an
early Camp detail implementation compared with the newer Team Session ID
standard. The biggest gaps are data bounding and mobile/desktop list patterns.

## Current Route Shape

Entry points:

- `app/(app)/team-camps/[id]/page.tsx`
- `app/(app)/team-camps/[id]/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/camps/detail-data.ts`
- `features/camps/camp-detail-tabs-client.tsx`
- `features/camps/detail/camp-goals-edit-surface.tsx`
- `features/camps/actions.ts`
- `features/camps/navigation.ts`
- `features/camps/detail-types.ts`
- Shared mobile header behavior in `components/site-header.tsx`

Page behavior:

- `page.tsx` requires authenticated access, resolves navigation scope, rejects
  missing organization/team scope, and then loads all Camp detail data through
  `getCampDetailPageData()`.
- The route accepts `tab` and `page` search params, but those values are only
  used as initial client state. Later tab changes and session page changes do
  not update the URL.
- The Camp title and venue/camp-type context render above `CampsFeedback` and
  the client tab surface.
- `loading.tsx` uses `CampDetailPageSkeleton`.

Data behavior:

- `getCampDetailPageData()` loads the camp, then its team venue, then venue,
  then all sessions for the camp.
- If sessions exist, it loads setup rows, review rows, session standard moves,
  and session wind patterns for every session in the camp.
- It then loads team standard move names and venue wind pattern names for every
  linked id found in those rows.
- KPI values, session list items, and notes cards are all derived from this
  full payload.

Client behavior:

- `CampDetailTabsClient` renders KPI cards, tab state, Sessions, Goals, and
  Notes.
- Sessions use a fixed `SESSIONS_PAGE_SIZE = 10`, but pagination happens in the
  browser over the full `sessions` prop.
- Goals editing uses `CampGoalsEditSurface`, which renders a mobile Drawer and
  desktop right Sheet with fixed header/footer, disabled pending state, and
  `Save` / `Saving...` submit feedback.
- Camp summary KPIs use `GradientCard`: one mobile card with divided rows and a
  desktop grid of gradient cards, matching Team Session ID summary cards.
- Camp date ranges render in abbreviated form, for example
  `Mar 25 - Mar 29 2026`.
- Notes render as local cards for every session that has notes/review/move/wind
  content.

Security behavior:

- The page requires authenticated context before loading.
- Data loading checks the active team through `team_venues.team_id` and active
  organization through `venues.organization_id`.
- `updateCampGoalsAction()` validates form input, checks
  `canManageTeamStructure()`, verifies camp scope, updates `camps.notes`, and
  redirects back to the Camp detail route.

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

- The remaining mobile UI gaps are concentrated in the Sessions tab list and
  pagination behavior.

### Mobile Card List Patterns

Matches:

- Sessions are tappable and navigate to Team Session detail.
- Notes are rendered as repeated cards and keep text fields scannable.
- Empty states are concise.

Gaps:

- Sessions are rendered as a dense divided list, not mobile cards split behind
  `md:hidden`.
- Mobile uses numbered pagination instead of the documented full-width
  `Load more` button.
- Pagination has no loading state, spinner, disabled pending state, or retained
  accumulated mobile context.
- Session navigation has no local pending affordance.
- Session page state is not preserved in the URL after client-side pagination.

### Desktop Table Patterns

Matches:

- The route page is server-first for auth, scope, permissions, and initial data.
- Desktop uses compact UI and real links for session navigation.

Gaps:

- The Sessions tab does not render a desktop table with stable headers and
  columns.
- Desktop pagination is client-only and does not query only the current page.
- There is no server-returned `pageCount`, `currentPage`, `hasPreviousPage`, or
  `hasNextPage` for Camp sessions.
- Page transitions do not use a table-centered loading overlay, `aria-busy`, or
  disabled pagination controls.
- Row detail prefetch on hover/focus is not present.

## Remaining Risks

1. Large camps can make the detail route slow because first render depends on
   all sessions plus all note/review/setup/move/wind-pattern rows.
2. The selected tab does not bound data loading. Opening the Goals tab still
   pays for Sessions and Notes data.
3. The Sessions tab does not match the current mobile card or desktop table
   standards, especially pagination/loading behavior.
4. Tab/page state is initialized from the URL but not kept in the URL after
   client interactions, so refresh/back/share behavior can drift from what the
   operator is seeing.
5. Runtime Supabase errors currently bubble through the nearest parent boundary;
   this route has no local `error.tsx` recovery surface.
6. There are no targeted tests for Camp detail route-state normalization, Goals
   save redirects, scoped access failures, or future tab-data API behavior.

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

- Keep the initial route shell small: camp, venue context, KPI summary, and only
  the selected tab payload.
- Add a scoped `/api/team-camps/[id]/tab-data` route or equivalent server-first
  fetch path for inactive tabs.
- Preserve active org/team/camp checks in the new data route.
- Add request-version protection in the client so stale tab responses cannot
  overwrite newer tab state.

Step 3: Align the Sessions tab with list/table standards.

- Desktop: render a table surface with stable columns, server page size 10,
  server page count, URL-backed page state, disabled pagination during
  transitions, and one table-centered loading overlay.
- Mobile: render compact cards behind `md:hidden`, use accumulated `Load more`,
  keep existing cards visible, and put pending state in the button.
- Preserve scope and `tab=sessions` in every generated href.
- Add detail prefetch on hover/focus where practical.

Step 4: Bound the Notes tab.

- Avoid building Notes cards for every session during initial route render.
- Load Notes only when the tab is selected.
- Page or incrementally load notes so large camps do not ship all text and
  linked move/wind-pattern context up front.
- Keep existing note field labels unless product copy is explicitly changed.

Step 5: Add route-level resilience and focused tests.

- Add `app/(app)/team-camps/[id]/error.tsx` with a scoped retry surface.
- Add narrow route-state tests for tab/page normalization and redirect
  preservation.
- Add action tests around invalid input, forbidden scope, missing camp, and
  successful Goals save redirect.
- Add timing logs for shell load, selected tab load, notes load, and Goals save
  so later performance work has real phase data.

## Validation

- Audit source review completed against:
  - `app/(app)/team-camps/[id]/page.tsx`
  - `features/camps/camp-detail-tabs-client.tsx`
  - `features/camps/detail-data.ts`
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
