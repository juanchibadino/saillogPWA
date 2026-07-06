# Team Sessions List Audit

Date: 2026-07-04

Scope: current `/team-sessions` list implementation. This audit is the new
post-implementation snapshot after the mobile UI, pending states, list timing,
update-scope hardening, narrow tests work, action-module split, row/card
actions menu, and list loading shell split.

The Team Session detail audit for `/team-sessions/[id]` remains separate in
`AUDIT_TEAM_SESSION_ID.MD`.

## Snapshot Register

### Foto anterior

Baseline before closing the implementation sequence:

- Mobile had list cards, but the operational surface still needed stronger
  action visibility, fixed-footer create/edit drawers, and clearer loading
  feedback.
- Create/edit submit feedback was not uniformly tied to form pending state.
- The list data path had no dedicated timing logs for scope, filters, or
  sessions phases.
- `updateSessionAction()` validated role and target camp scope, but did not
  explicitly resolve the existing session ownership chain before update.
- Create/update redirects preserved org/team, venue, camp, and page, but not
  the active Highlight filter.
- No narrow automated tests covered filter normalization, desktop pagination,
  mobile `Load more`, create/update redirects, or non-managing permission
  behavior.
- Main risks were invisible data-path regressions, reliance on RLS as the only
  existing-session update backstop, and lack of focused regression coverage.

### Foto nueva

Current state after the implementation sequence:

- Mobile has a visible `New session` FAB, full-width `Load more sessions`, card
  navigation spinners, fixed-footer create/edit drawers, and `h-11` controls.
- Create/edit forms use `useFormStatus()` pending buttons, disabled fields, and
  toast feedback through `SessionsFeedback`.
- The list now emits `team_sessions_list_timing` logs for `scope`, `filters`,
  and `sessions`, including counts/page metadata.
- Initial route loading now uses a stable list chrome/results split:
  `TeamSessionsRouteShell` keeps title, filters, desktop `New`, mobile FAB,
  and filter-pending overlays mounted while the results table/cards load behind
  a nested `Suspense` boundary.
- The data path is split into `getTeamSessionsChromeData()` for filter/create
  chrome and `getTeamSessionsResultsData()` for sessions, page count, and
  pagination state. `getTeamSessionsPageData()` remains as compatibility
  composition for shared callers.
- `updateSessionAction()` resolves session -> camp -> team venue -> venue
  against the active org/team before writing.
- Target camp validation now checks both active team and active organization.
- Create/update forms carry `scopeHighlight`; redirects preserve org/team,
  venue, camp, highlight, and page.
- List mutations now live in `features/sessions/list-actions.ts`; detail
  mutations live in `features/sessions/detail-actions.ts`; the old
  `features/sessions/actions.ts` file is only a compatibility barrel.
- Table rows and mobile cards now use a horizontal-more actions menu with
  `Edit` and `Delete`; delete confirms use a blurred modal overlay.
- `npm test` now runs focused Node tests for route helpers and permission
  rules without adding a new dependency.
- The list route remains server-first with desktop table, mobile cards, route
  skeleton, desktop pagination, and mobile accumulation.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.5/5 | The route fetches a small visible session page, supports desktop pagination and mobile accumulation, prefetches detail routes on row/card intent, logs `scope`, `filters`, and `sessions` server phases, and now streams stable list chrome separately from results. The remaining gap is that chrome still builds the filtered camp catalog before results can render. |
| UI consistency | 4.9/5 | Desktop stays table-first. Mobile uses cards, an explicit FAB, full-width load more, horizontal-more row/card actions, fixed footer drawers, touch-safe controls, blurred delete confirms, bottom toast feedback, and a loading shell that keeps title/actions visible. This now matches the accepted Sailog mobile list pattern. |
| Code tidiness | 4.4/5 | Route state helpers, timing helpers, permission rules, list mutations, detail mutations, chrome data, results data, and the client shell are separated from the page and table. The old `features/sessions/actions.ts` remains only as a compatibility barrel. |
| Scalability | 4.0/5 | Session rows are paged and mobile accumulation avoids replacing prior cards. Timing logs make pressure visible. The main scalability risk is still the sequential team venue -> venue -> camp -> session path and potentially large `camp_id IN (...)` filters. |
| Best practices | 4.6/5 | Auth and writes are server-first, inputs are validated, RLS remains the database backstop, pending states are visible, redirects preserve active filters, and focused regression tests now cover the pure route/permission rules. Missing coverage is browser/database integration for the actual forms. |
| Modularity | 4.3/5 | The list page delegates table UI, toolbar UI, forms, route state, timing, data loading, permission rules, and list mutations to separate files. Create/edit surface wiring still has some Drawer/Sheet/Dialog duplication. |
| Security | 4.7/5 | Creates validate role, camp team/org scope, team organization, and billing entitlement. Updates and deletes validate role plus existing session ownership before writing. RLS remains defense in depth. |

Overall: 4.6/5. The `/team-sessions` list is now operationally solid for the
current MVP. Remaining work is mostly observability follow-through, data-path
optimization if timings justify it, and broader integration coverage.

## Current Architecture

Entry points:

- `app/(app)/team-sessions/page.tsx`
- `app/(app)/team-sessions/loading.tsx`
- `features/sessions/data.ts`
- `features/sessions/sessions-table.tsx`
- `features/sessions/team-sessions-route-shell.tsx`
- `features/sessions/team-sessions-toolbar.tsx`
- `features/sessions/session-form-dialogs.tsx`
- `features/sessions/list-actions.ts`
- `features/sessions/actions.ts` compatibility exports
- `features/sessions/navigation.ts`
- `features/sessions/list-route-state.mjs`
- `features/sessions/list-timing.ts`
- `lib/auth/capability-rules.mjs`
- `lib/validation/sessions.ts`

Test entry points:

- `features/sessions/list-route-state.test.mjs`
- `lib/auth/capability-rules.test.mjs`
- `package.json` script: `npm test`

Data behavior:

- The page requires authenticated access and an active navigation scope.
- `resolveTeamSessionsListRequest()` normalizes page, `loadMore`, and highlight
  params.
- `getTeamSessionsChromeData()` loads team venues, venues, camps, and normalized
  filter/create options.
- `getTeamSessionsResultsData()` loads the count-backed visible sessions page
  from the already resolved chrome/filter data.
- `getTeamSessionsPageData()` composes chrome plus results for shared callers
  that still need the full payload.
- Venue and camp filters are normalized against allowed IDs.
- Highlight accepts only `yes` or `no`.
- `TEAM_SESSIONS_PAGE_SIZE` remains `10`.
- Desktop pagination replaces the page via `page=N`.
- Mobile `Load more` adds `loadMore=1`, accumulates pages `1..N`, and keeps
  prior cards visible.
- Timing logs use `msg: "team_sessions_list_timing"` with `scope`, `filters`,
  and `sessions` phases.

UI behavior:

- Desktop renders a table with date, type, camp, venue, net time, highlight,
  and actions.
- Mobile renders tappable cards with nested horizontal-more action menus that
  stop propagation.
- Row/card navigation shows a local spinner and prefetches detail routes on
  hover/focus.
- Desktop filters stay in dropdown controls with clear buttons and a single
  table overlay spinner while navigating.
- Mobile filters live in a Drawer and use one centered card-list spinner while
  navigating.
- Initial loading keeps the list chrome visible through `TeamSessionsRouteShell`;
  only the table/cards/pagination results area uses `TeamSessionsResultsSkeleton`
  once chrome data has resolved.
- `TeamSessionsPageSkeleton` is still the route-level fallback, but it is now
  composed from `TeamSessionsChromeSkeleton` and `TeamSessionsResultsSkeleton`
  so direct route loads and deferred list loads share the same pieces.
- Create/edit surfaces keep mobile Drawer and desktop Sheet/Dialog patterns.
- Delete confirm modals use a blurred overlay and destructive submit state.
- Submit buttons show `Creating...` / `Saving...` / `Deleting...` while pending.

Mutation behavior:

- `createSessionAction()` validates input, scope, role, target camp team/org
  ownership, team organization, and billing entitlement before insert.
- `updateSessionAction()` validates input, scope, role, existing session
  ownership, and target camp team/org ownership before update.
- `deleteSessionAction()` validates input, scope, role, and existing session
  ownership before delete, then cleans linked Storage objects best-effort.
- Both actions revalidate `/team-sessions`, `/team-camps`, and `/team-home`.
- Redirects preserve org/team, venue, camp, highlight, and page.

## Current Risks

1. The timing logs are in place, but there is still no live threshold or
   dashboard that turns slow `filters` or `sessions` phases into an operational
   signal.
2. The data loader still pays for the filtered camp catalog on each render. If
   timings show pressure, the next data-path step should avoid rebuilding the
   full catalog or reduce the `camp_id IN (...)` shape.
3. The focused tests cover pure helpers and permission rules, not full
   browser/database create/update/delete submissions.
4. Create/update/delete remain redirecting server actions. That is simple and
   stable, but it is not optimistic row insertion/update/removal.

## Validation Snapshot

Latest validation after the list shell/results loading split:

- `git diff --check` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run lint` exited 0 with two unrelated existing warnings:
  `app/sign-in/sign-in-content.tsx` unused `isRegisterMode`, and
  `features/onboarding/onboarding-flow.tsx` unused `Label`.
- `npm test` passed with 18 tests.
- `npm run build` passed.

## New Engineering Priority

1. Capture live timing samples for `/team-sessions` using the new
   `team_sessions_list_timing` logs.
2. If `filters` is the slow phase, cache or further split the
   `getTeamSessionsChromeData()` camp/filter catalog so the list chrome appears
   even sooner.
3. If `sessions` is the slow phase, revisit the `camp_id IN (...)` query shape
   and consider a scoped read model.
4. Add browser/database integration coverage for create/update/delete form
   submission, including forbidden role paths.
5. If detail mutation code grows further, split `features/sessions/detail-actions.ts`
   by domain family such as info, setup, assets, gear, and results.
