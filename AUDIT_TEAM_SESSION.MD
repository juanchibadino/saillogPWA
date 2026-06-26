# Team Session Audit

Date: 2026-06-25

Scope: current `/team-sessions` list implementation. This audit covers the
Team Sessions index page with desktop table, mobile cards, filters, pagination,
and the `New` session CTA. The Team Session detail audit for
`/team-sessions/[id]` now lives in `AUDIT_TEAM_SESSION_ID.MD`.

Performance measurement caveat: this is a code-path audit, not a live RES/Core
Web Vitals report. The page has a route-level skeleton and progressive list
loading, but no dedicated timing logs or post-deploy metric sample for the
Team Sessions index page yet.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.1/5 | The page is server-first, renders a route-level skeleton, fetches only 10 visible sessions by default, supports mobile `Load more`, uses desktop pagination, and prefetches detail routes on hover/focus. Remaining gap is the data loader still performs sequential team venues -> venues -> camps -> sessions reads and loads the full camp/filter catalog for the active filtered scope before fetching the paged session rows. |
| UI consistency | 4.6/5 | Desktop uses a table and mobile uses tappable cards. Desktop filters stay as dropdowns; mobile filters use a Drawer with `h-11` controls. The `New` CTA now uses the mobile FAB pattern, while desktop keeps the right-side Sheet trigger. Mobile create/edit Drawers now use fixed footer layout, scrollable content, `h-11` controls, full-width primary actions, visible pending states, and the same bottom toast feedback used by Team Session ID. |
| Code tidiness | 3.7/5 | The route delegates list rendering, toolbar, data, and forms to feature files. `app/(app)/team-sessions/page.tsx` is still readable at 313 lines. The heavier files are `features/sessions/session-form-dialogs.tsx` at 734 lines and the shared `features/sessions/actions.ts` at 3907 lines, which mixes list creates/updates with Team Session ID detail mutations. |
| Scalability | 3.9/5 | Session rows are paged with a limit-plus-one pattern and mobile accumulation avoids replacing already visible cards. Existing indexes cover `sessions(camp_id, session_date desc, created_at desc)`. Risk remains in building filters by loading all camps for the active venue/team scope and querying sessions with a potentially large `camp_id IN (...)` list. |
| Best practices | 4.3/5 | Access is server-first, external input is normalized and validated with Zod, RLS remains the database backstop, list loading has a route skeleton, form submits use `useFormStatus()` pending states, and client navigations use `useTransition` for row/card and `Load more` states. Missing pieces are route-specific error recovery and targeted tests for pagination/filter/create/update flows. |
| Modularity | 3.8/5 | The page is split into `TeamSessionsTable`, `TeamSessionsToolbar`, `SessionDialogForm`, and `getTeamSessionsPageData()`. The split is functional, but create/edit wrappers duplicate Drawer/Sheet/Dialog wiring, and `actions.ts` is too broad for the list mutation surface. |
| Security | 4.4/5 | Reads require authenticated access and active navigation scope, then rely on scoped IDs plus RLS. Creates check `canManageTeamSessions()`, validate the camp belongs to the active team, verify the team belongs to the active organization, and enforce billing entitlement before insert. Updates check role and target camp scope; RLS prevents updates to sessions outside the current manageable camp, but the app-level update path could still be hardened by resolving the existing session ownership chain before writing. |

Overall: 4.2/5. The Team Sessions index is solid enough for current operational
use, with the main gaps now concentrated in list data-path efficiency,
update-scope hardening, and test coverage.

## Current Route Shape

Entry points:

- `app/(app)/team-sessions/page.tsx`
- `app/(app)/team-sessions/loading.tsx`
- `features/sessions/data.ts`
- `features/sessions/sessions-table.tsx`
- `features/sessions/team-sessions-toolbar.tsx`
- `features/sessions/session-form-dialogs.tsx`
- `features/sessions/actions.ts`
- `features/sessions/navigation.ts`
- `lib/validation/sessions.ts`

Data behavior:

- The route requires authenticated access and resolves active organization/team
  scope before loading Team Sessions data.
- `getTeamSessionsPageData()` loads team venues, venues, camps, then sessions.
- Venue, camp, and highlight filters are normalized against allowed option sets.
- `TEAM_SESSIONS_PAGE_SIZE` is `10`.
- Desktop pagination replaces the page with `page=N`.
- Mobile `Load more` keeps prior cards visible through `loadMore=1` and
  `accumulatePages`.
- The list item payload stays intentionally small: date, type, camp, venue, net
  time, and highlighted status.

UI behavior:

- Desktop renders a `Table` with date, type, camp, venue, net time, highlight,
  and row action columns.
- Mobile renders cards with the same core fields and a nested edit action that
  stops propagation.
- Mobile shows a full-width `Load more sessions` action below the cards when
  more rows are available.
- Cards and rows navigate to `/team-sessions/[id]`, set an in-row/card loading
  spinner, and prefetch the detail route on hover/focus.
- Desktop filters are dropdown menus for Venue, Camp, and Highlight.
- Mobile filters live in a Drawer with draft state and explicit `Apply` /
  `Clear` actions.
- The `New` CTA is disabled when there is no active team, no manage permission,
  or no camp options.

Mutation behavior:

- `createSessionAction()` validates input, scope, role, camp ownership,
  organization ownership, and billing entitlement before inserting.
- `updateSessionAction()` validates input, scope, role, and target camp
  ownership before updating.
- Both actions revalidate `/team-sessions`, `/team-camps`, and `/team-home`.
- Both actions redirect back to `/team-sessions` with status/error params while
  preserving org/team scope, active venue/camp filters, and page.

## Remaining Risks

1. The list page has no dedicated timing instrumentation, so regressions in
   team venues, camp catalog, filter building, or session query time are not
   visible until users feel them.
2. The server data loader is still a sequential multi-query path. This is fine
   for the current scale, but large teams with many venues/camps will pay for
   the full filter catalog on every list render.
3. Create/update still use redirecting server actions only. That keeps the code
   simple, but it means no optimistic row insertion/update and no in-place
   rollback semantics.
4. `updateSessionAction()` relies on RLS to block a malicious update against an
   existing session outside the active team. That is safe as a database
   backstop, but app-level checks should resolve the existing session chain
   before writing for clearer defense in depth.
5. There are no targeted automated tests for filter normalization, page/load
   more behavior, create/update redirects, or permission failure states.

## Validation

- Read `app/(app)/team-sessions/page.tsx`.
- Read `app/(app)/team-sessions/loading.tsx`.
- Read `features/sessions/data.ts`.
- Read `features/sessions/sessions-table.tsx`.
- Read `features/sessions/team-sessions-toolbar.tsx`.
- Read `features/sessions/session-form-dialogs.tsx`.
- Read list create/update paths in `features/sessions/actions.ts`.
- Read `lib/validation/sessions.ts`.
- Confirmed existing session indexes in `supabase/migrations/001_initial_schema.sql`
  and `supabase/migrations/007_team_ops_speed_indexes.sql`.
- Confirmed current mobile list/toolbar/form expectations in
  `MOBILE_UI_PATTERNS.md`.
- Step 1 validation after implementation:
  `./node_modules/.bin/eslint 'app/(app)/team-sessions/page.tsx' features/sessions/session-form-dialogs.tsx features/sessions/team-sessions-toolbar.tsx features/sessions/sessions-table.tsx`
  passed with no output.
- Step 1 validation after implementation: `./node_modules/.bin/tsc --noEmit`
  passed with no output.
- Step 1 validation after implementation: `npm run build` passed.
- Step 1 browser validation after implementation: production local server on
  `localhost:3003`, authenticated as `tester@sailog.test`, viewport `390x844`.
  Confirmed `/team-sessions` has no error overlay, renders the mobile filter
  button plus `New session` FAB, opens Create Session Drawer, opens Edit Session
  Drawer, and opens Filters Drawer. Create/Edit/Filters Drawer controls and
  footer actions measured `44px` high.
- Step 1 follow-up validation: edit surfaces now use the session date as the
  title, `Highlighted by coach` uses a larger Switch surface, and Net time
  normalizes to `h/m` display such as `1h 15m` instead of decimal hours.
  `./node_modules/.bin/eslint features/sessions/session-form-dialogs.tsx components/ui/switch.tsx`,
  `./node_modules/.bin/tsc --noEmit`, and scoped `git diff --check` passed.
- Step 2 validation after implementation:
  `./node_modules/.bin/eslint features/sessions/session-form-dialogs.tsx`
  passed with no output.
- Step 2 validation after implementation: `./node_modules/.bin/tsc --noEmit`
  passed with no output.
- Step 2 follow-up: `/team-sessions` status/error feedback now uses
  `SessionsFeedback mode="toast"` like `/team-sessions/[id]`, removing the
  inline success/error banner from the list page.
- Step 2 follow-up: `SessionsFeedback` no longer has an inline success/error
  banner branch; session feedback now only emits bottom toasts and clears the
  URL params.
- Step 2 follow-up validation:
  `./node_modules/.bin/eslint 'app/(app)/team-sessions/page.tsx' features/sessions/sessions-feedback.tsx`,
  `./node_modules/.bin/tsc --noEmit`, and scoped `git diff --check` passed.
- Mobile load-more follow-up: the mobile card list now exposes a full-width
  `h-11` `Load more sessions` action while preserving the existing
  `loadMore=1` accumulation and `Loading more...` spinner behavior.
- Mobile load-more follow-up validation:
  `./node_modules/.bin/eslint features/sessions/sessions-table.tsx`,
  `./node_modules/.bin/tsc --noEmit`, and scoped `git diff --check` passed.

## Next Engineering Priority

Step 1: Align the mobile operational surface.

- Status: implemented 2026-06-25.
- Moved the mobile `New` session action to the established
  `mobile-floating-action size-14` FAB pattern.
- Kept desktop dropdown filters and desktop right Sheet behavior unchanged.
- Converted mobile create/edit Drawers to fixed header/footer and scrollable
  body.
- Changed edit surface titles from `Edit session` to the session date.
- Replaced the `Highlighted by coach` checkbox with a larger Switch surface.
- Changed Net time display from decimal hours to `h/m` text while keeping the
  submitted value in minutes.
- Aligned the mobile header with the Team Session detail title scale: `Session`
  on the left and the filter icon action on the right.
- Made mobile pagination explicit with a full-width `h-11`
  `Load more sessions` action below the cards.
- Brought mobile filter controls, session form selects/inputs, card action
  buttons, steppers, and primary save actions to the `h-11` / `h-11 w-11`
  standard.

Step 2: Add visible submit pending states.

- Status: implemented 2026-06-25.
- Added `useFormStatus()` backed submit buttons for create and edit.
- Disabled form fields and submit actions while pending.
- Added `Creating...` and `Saving...` spinner labels.
- Switched create/update success and error feedback to the shared bottom toast
  mode used by Team Session ID.
- Kept row/card navigation spinners and `Load more` spinner behavior unchanged.

Step 3: Tighten the list data path.

- Add lightweight timing logs for list page phases: scope, filters, sessions.
- Collapse the team venue/venue/camp/session path if real timing shows pressure.
- Consider a scoped read model or embedded select that avoids rebuilding the
  full filter catalog on every list render.
- Keep the current page size and mobile accumulation behavior unless live data
  shows a reason to change it.

Step 4: Harden update scope.

- Resolve the existing session -> camp -> team venue -> team/venue chain before
  update, matching the stricter Team Session ID mutation style.
- Keep RLS as the database backstop, but make the app-level failure path
  explicit and auditable.

Step 5: Add narrow tests.

- Cover invalid venue/camp filters normalizing away.
- Cover desktop page navigation and mobile `Load more`.
- Cover create/update redirects preserving scope/filter/page params.
- Cover forbidden create/update responses for non-managing roles.
