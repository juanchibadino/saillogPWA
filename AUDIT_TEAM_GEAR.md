# Team Gear Audit

Date: 2026-07-11

Scope: current `/team-gear` implementation after the responsive route,
loading, data-bounding, computed Gear list RPC, loader integration coverage,
desktop `GradientCard` table normalization, feedback, and regression-test
improvements.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`

Closest mature route references:

- `/team-standard-moves`
- `/team-sessions`
- `/team-reports`
- `/reports`

## Executive State

`/team-gear` now matches the Sailog list-route standard: stable chrome renders
separately from deferred results, mobile uses cards and accumulated load-more,
desktop uses a `GradientCard` table with numbered pagination, create/edit
surfaces are responsive Drawer/Sheet flows, and transient action feedback uses
global Sonner toasts.

Current re-audit result: 4.6/5.

Previous post-implementation result: 4.5/5.

Previous audit baseline: 2.7/5.

The route is production-shaped for list usage. Alert-aware pagination is
computed in the database through `get_team_gear_list_rows()`, all filters use
the same bounded list path, and the route-level results loader has a
browser-free integration test around the RPC-backed path.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance | 4.6/5 | `get_team_gear_list_rows()` computes usage and alert state in SQL, filters by `alert` before pagination, and returns only the requested page plus `total_count`. The app hydrates edit-form alert rules only for visible ids. |
| UI consistency | 4.7/5 | Mobile cards, mobile filter Drawer, mobile FAB Drawer, desktop inline filters, desktop `GradientCard` table, desktop numbered pagination, and right Sheet create/edit now match the repo patterns. |
| Code tidiness | 4.2/5 | Route state, action core, data core, loader results core, shell, table, retry, and feedback are split. `gear-form-dialogs.tsx` is still large because it owns scanner, form body, Drawer/Sheet wrappers, action menu, and retire form. |
| Scalability | 4.6/5 | Type/status/condition/alert filtering now share one computed RPC path with SQL pagination and exact total count. Remaining scaling work is mostly query-plan validation and index tuning if live data exposes slow plans. |
| Best practices | 4.6/5 | Server-first auth/scope resolution, nested `Suspense`, local transition overlays, `aria-busy`, Sonner toasts, route-state helpers, focused node tests, and a loader integration test are in place. |
| Modularity | 4.3/5 | `TeamGearRouteShell`, `TeamGearResultsRetry`, `list-route-state.mjs`, `data-core.mjs`, `data-results-core.mjs`, and `action-core.mjs` reduce route coupling. The form module is the remaining split candidate. |
| Security | 4.6/5 | Mutations recheck auth, capability, org/team scope, team ownership, and gear ownership. Tests now cover forbidden and cross-team writes. Remaining hardening is transactional create/update of alert rules. |

## Source Map

Route and skeletons:

- `app/(app)/team-gear/page.tsx`
- `app/(app)/team-gear/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `components/site-header.tsx`

Feature modules:

- `features/gear/list-route-state.mjs`
- `features/gear/data-core.mjs`
- `features/gear/data-loader-core.mjs`
- `features/gear/data-results-core.mjs`
- `features/gear/data.ts`
- `features/gear/action-core.mjs`
- `features/gear/actions.ts`
- `features/gear/team-gear-route-shell.tsx`
- `features/gear/team-gear-toolbar.tsx`
- `features/gear/gear-table.tsx`
- `features/gear/gear-form-dialogs.tsx`
- `features/gear/gear-feedback.tsx`
- `features/gear/team-gear-results-retry.tsx`
- `features/gear/shared.ts`

Regression tests:

- `features/gear/list-route-state.test.mjs`
- `features/gear/action-core.test.mjs`
- `features/gear/data-core.test.mjs`
- `features/gear/data-loader-core.test.mjs`
- `features/gear/data-results-core.test.mjs`
- `features/testing/server-action-harness.mjs`

Schema/security:

- `lib/validation/gear.ts`
- `lib/auth/capabilities.ts`
- `supabase/migrations/022_gear_module_v1.sql`
- `supabase/migrations/030_bound_session_catalog_indexes.sql`
- `supabase/migrations/035_team_gear_list_rows.sql`

## Current Route Shape

`app/(app)/team-gear/page.tsx` now follows the list-route shell/results pattern:

- Auth and navigation scope resolve server-side before rendering the page.
- URL state is normalized by `resolveTeamGearListRequest()`.
- Persistent missing-organization, missing-team, and read-only warnings remain
  inline.
- `getTeamGearChromeData()` normalizes selections and returns option metadata
  without loading rows.
- `TeamGearRouteShell` renders stable title, filters, desktop create action,
  mobile FAB, and local filter-transition overlays.
- Results load inside a nested `Suspense` boundary with
  `TeamGearResultsSkeleton`.
- Result failures leave shell chrome mounted through `TeamGearResultsRetry`.
- `TeamGearTable` owns visible rows/cards, mobile load-more, desktop numbered
  pagination, and page-transition overlays.

This matches `LOADING_PATTERNS.md`: chrome stays mounted while result rows/cards
resolve, and secondary loading dims the existing result surface instead of
clearing it.

## Loading Pattern Fit

Matches:

- Route-level `loading.tsx` uses `TeamGearPageSkeleton`.
- `TeamGearPageSkeleton` is composed from `TeamGearChromeSkeleton` and
  `TeamGearResultsSkeleton`.
- Cold loading mirrors mobile title/filter/FAB/cards and desktop filters/table
  pagination.
- Nested result fallback mirrors only the result area.
- Filter transitions keep mounted results dimmed and disabled with one overlay.
- Mobile filter overlay is centered between header and bottom nav.
- Desktop page transitions center a spinner over the table region.
- Mobile load-more keeps existing cards mounted and puts the spinner inside the
  `Load more gear` button.
- Result failure is localized with `TeamGearResultsRetry`.

Watch item:

- Filter transition completion still depends on App Router navigation timing.
  The route handles the visible state correctly, but future cache work should
  keep checking for stale pending state edge cases after rapid repeated filter
  clicks.

## Mobile UI Pattern Fit

Matches:

- `/team-gear` is included in the selected-route mobile header group.
- Mobile header uses the phase-one shape: back action on the left, title, and
  sidebar/menu trigger on the right.
- Back action routes to scoped `/team-home`.
- Mobile filter trigger is an `h-11 w-11` icon button.
- Mobile filters live in one grouped Drawer for Type, Status, Condition, and
  Alerts.
- Mobile list uses cards, not the desktop table.
- Cards show name, type/status, condition, usage, alert state, identifiers, and
  a touch-sized action trigger.
- Mobile create uses the `mobile-floating-action size-14` FAB.
- Mobile create/edit use bottom Drawers.
- Drawer form uses fixed header, scrollable body/fieldset, fixed footer.
- Drawer submit is `h-11 w-full`.
- Mobile inputs/selects/scanner-adjacent controls use `h-11`.
- Edit labels use `Save` and `Saving...`; create uses `Create item` and
  `Creating item...`.
- Pending state stays inside the submitted button.

Remaining note:

- The scanner remains a nested Dialog inside the responsive form. It remains
  usable, but if scanner UX becomes a focus, it should be tested on physical
  mobile Safari/Chrome because camera permission behavior cannot be fully
  covered by headless smoke.

## Desktop UI Pattern Fit

Matches:

- Desktop keeps compact inline dropdown filters.
- Active filters are visually indicated.
- Clearing a filter routes through the same href builder and preserves the
  remaining filters and scope.
- Desktop uses a table-only surface.
- Mobile cards are hidden on desktop.
- Desktop create/edit use a right Sheet.
- Table columns are stable: Name, Type, Usage, Status, Condition, Alerts, and
  row actions.
- Pagination uses Previous, page numbers, ellipses, and Next.
- Active page exposes `aria-current="page"`.
- Desktop page changes disable/dim the mounted table and show one centered
  overlay spinner.
- Row retire pending state is local to the row action trigger/menu.

Wrapper note:

- The final desktop table now uses the standard `GradientCard` framed table
  surface with `overflow-hidden p-0`, matching the desktop table skeleton and
  the current `DESKTOP_UI_PATTERNS.md` guidance.

## Data And Performance Details

Current behavior:

- `TEAM_GEAR_PAGE_SIZE` is `25`.
- `get_team_gear_list_rows()` accepts team, type, status, condition, alert,
  limit, and offset.
- The RPC computes `usage_count`, `usage_minutes`, `alert_state`, and
  `triggered_alert_count` before pagination.
- `alert` filters are now applied inside the computed SQL result, not by a
  full application-side derived pass.
- The RPC returns `total_count` for desktop page count and mobile load-more
  state.
- `resolveTeamGearListRowsPage()` handles requested-page clamping and mobile
  accumulated ranges.
- `data-results-core.mjs` assembles the route results from the computed RPC and
  the visible-id alert-rule lookup so the path can be tested without a browser.
- `getTeamGearResultsData()` fetches alert-rule details only for the returned
  visible gear ids so edit forms can still render existing rules.
- `features/gear/data-results-core.test.mjs` verifies the loader path calls the
  computed RPC with alert filters, hydrates only visible alert-rule ids, and
  avoids direct `gear_items`, `session_gear_usage`, or `sessions` fallback
  hydration in that path.

## Route State And Actions

Route-state helpers now own:

- Filter normalization for `type`, `statusFilter`, `condition`, and `alert`.
- Defensive page normalization.
- `loadMore=1` mobile accumulation.
- Page href building that preserves org/team/filter state.
- Redirect path building for create/update/retire.

Server actions now run through `action-core.mjs` so behavior can be tested
without a browser. Covered paths include:

- Create/update/retire success redirects.
- Preservation of org/team/filter/page/loadMore state.
- Forbidden create/update/retire.
- Cross-team update/retire attempts.
- Invalid alert-rule payload handling.
- Revalidation of `/team-gear`.

Security posture remains strong:

- Actions require authenticated access context.
- Actions validate org/team scope from hidden inputs.
- Actions check the Team Sessions management capability family.
- Writes confirm team organization ownership.
- Update/retire confirm the gear item belongs to the scoped team.

Remaining note:

- Create currently inserts the gear row and then inserts alert rules, with a
  manual delete rollback if alert-rule insert fails. That is acceptable for this
  phase, but a transaction/RPC would be cleaner if Gear alert rules become more
  business-critical.

## Feedback

Transient action feedback now matches the shared Sonner pattern:

- Success uses `toast.success()`.
- Error uses `toast.error()`.
- Toast ids are stable by pathname plus status/error value.
- Consumed `status` and `error` params are removed with
  `router.replace(..., { scroll: false })`.
- Persistent missing-scope and read-only panels remain inline.

## Completed Implementation Ledger

- Step 1: route-state helpers and tests - complete.
- Step 2: chrome/results data split - complete.
- Step 3: bounded result loading - complete.
- Step 4: `TeamGearRouteShell` - complete.
- Step 5: responsive toolbar/filter Drawer - complete.
- Step 6: mobile cards and desktop numbered pagination - complete.
- Step 7: Drawer/Sheet create/edit surfaces - complete.
- Step 8: Sonner feedback - complete.
- Step 9: result skeletons and retry - complete.
- Step 10: selected-route mobile header inclusion - complete.
- Step 11: focused regression coverage - complete.
- Step 12: static validation and browser smoke - complete.
- Follow-up: computed Gear list RPC for alert-aware pagination - complete.
- Follow-up: loader integration test around the computed RPC path - complete.
- Follow-up: desktop table wrapper consistency with `GradientCard` - complete.

Not completed in this batch:

- Split `gear-form-dialogs.tsx` into scanner, shared form body, create/edit
  wrappers, action menu, and retire form modules. The file is still functional
  but large at roughly 1.2k lines.

## Validation

Static validation:

- `npm run lint` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `node --test features/gear/data-results-core.test.mjs features/gear/data-loader-core.test.mjs features/gear/data-core.test.mjs features/gear/list-route-state.test.mjs features/gear/action-core.test.mjs` passed with 18 tests.
- `npm test` passed with 129 tests.
- `git diff --check` passed.
- `npm run build` passed.

Known lint warnings:

- `app/sign-in/sign-in-content.tsx`: unused `isRegisterMode`.
- `features/onboarding/onboarding-flow.tsx`: unused `Label`.

Browser smoke:

- Agent Browser was blocked by local socket/bind permissions, so Playwright was
  used against the local dev server.
- Mobile `/team-gear` passed: phase-one header, scoped back action to
  `/team-home`, right menu trigger, filter Drawer, mobile cards, FAB create
  Drawer, create pending label, edit save pending label, and accumulated load
  more.
- Desktop `/team-gear` passed: inline filters, table, create right Sheet, edit
  right Sheet, numbered pagination with `aria-current="page"`, retire action
  submission, and retire pending `aria-busy`.
- Temporary Gear rows used for load-more and pending-state smoke were deleted
  and confirmed with zero remaining rows.

## Remaining Risks

1. Form module size and reviewability.
   `gear-form-dialogs.tsx` is still the largest Gear client module. A future
   cleanup should split scanner, shared form body, responsive surface wrappers,
   action menu, and retire form without changing behavior.

2. Transactional alert-rule writes.
   Create/update alert-rule replacement would be cleaner behind a database RPC
   or transaction if this area becomes critical.

3. Physical-device scanner confidence.
   Headless smoke verifies the surfaces and controls, not real camera
   permission behavior.

4. Query plan confidence on larger data.
   The RPC is bounded and correct, but large live inventories should be checked
   with `explain analyze` if alert-heavy teams start showing slow pages.

## Next Engineering Priority

1. Split `gear-form-dialogs.tsx`.
   Keep the same public props, but move scanner, form body, create/edit
   wrappers, and action menu into smaller files.

2. Add query-plan validation for `get_team_gear_list_rows()`.
   Use representative Gear/session/rule volume and check type/status/condition
   and alert-filtered pages with `explain analyze`.

3. Move alert-rule create/update replacement behind a transaction/RPC.
   This would remove the manual delete rollback used after create-rule insert
   failures.

## Re-Audit Conclusion

`/team-gear` has moved from a functional phase-two list to a route that matches
the mature Sailog operational-list pattern. The important behavior is now in
the right layers: URL state is centralized, chrome/results are split, all
filters use the SQL-computed list path, result hydration is bounded to visible
ids, mobile and desktop render separate optimized surfaces, and transient
feedback uses global toasts.

The remaining work is maintainability and production confidence, not core route
shape: split the large form module, validate the RPC query plan against larger
Gear inventories, and move alert-rule replacement into a transaction/RPC if
those writes become more critical.
