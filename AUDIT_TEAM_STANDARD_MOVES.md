# Team Standard Moves List Audit

Date: 2026-07-09

Scope: current post-implementation audit for `/team-standard-moves`, centered on
`app/(app)/team-standard-moves/page.tsx` and the supporting Standard Moves
feature modules.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`

## Executive State

`/team-standard-moves` is now aligned with the current Sailog list-route
standard. The old baseline gaps around transient inline feedback, desktop-only
table UI, full-route loading, unbounded list behavior, and missing mutation
coverage have been closed.

Current result: 4.4/5.

The route now has:

- Sonner-only transient success/error feedback with URL cleanup.
- Inline persistent panels for missing scope, missing team, and read-only
  access.
- Mobile cards plus desktop table.
- A single mobile `mobile-floating-action size-14` create FAB.
- Mobile Status filtering in a bottom Drawer.
- Desktop Status filtering in the toolbar.
- Mobile Drawer and desktop right Sheet create/edit surfaces.
- Fixed form header/footer, scrollable form body, disabled fieldset, and pending
  submit button.
- Visible archive/restore pending state in the row/card action trigger.
- Normalized `statusFilter`, `page`, and mobile `loadMore` route state.
- Split chrome/results loading and data fetching.
- Explicit page size, desktop pagination, and mobile accumulated `Load more`.
- Bounded usage counting against visible rows only.
- Mirrored route skeletons for mobile cards/FAB and desktop table headers.
- Local secondary loading overlays for filter/page transitions.
- Local retry behavior for nested results failure.
- Focused action and route-state regression coverage.
- Authenticated browser smoke coverage for mobile Drawer/FAB and desktop
  Sheet/table paths.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance | 4.1/5 | The route is server-first, page-bounded, and split into stable chrome plus result data. Usage counts are bounded to visible moves. Remaining opportunity: add local timing logs and replace per-visible-move exact count fanout with grouped aggregate/RPC if teams grow much larger. |
| UI consistency | 4.6/5 | The route matches the current mobile cards + desktop table standard, mobile FAB, mobile Status Drawer, desktop toolbar filter, mobile Drawer forms, desktop Sheet forms, pending controls, and mirrored skeletons. |
| Code tidiness | 4.4/5 | Route state, shell, retry, data, table, toolbar, forms, feedback, and action-core logic are separated into feature files. `actions.ts` is now a thin server wrapper over testable action-core functions. |
| Scalability | 4.1/5 | Results are page-bounded at `TEAM_STANDARD_MOVES_PAGE_SIZE = 25`, desktop pagination and mobile accumulation are explicit, and usage work is bounded to visible ids. A grouped SQL/RPC aggregate would be the next scale improvement. |
| Best practices | 4.5/5 | Server-first access checks, RLS-backed writes, Sonner URL-param feedback cleanup, route-state normalization, nested Suspense/retry, focused tests, browser smoke, disabled fieldsets, pending buttons, and mirrored skeletons are in place. |
| Modularity | 4.4/5 | The implementation follows the newer Sailog list-shell shape used by Sessions, Camps, and Team Venues: route-state helpers, chrome/results split, client shell, results retry, and table-owned pagination. |
| Security | 4.5/5 | Mutations recheck authenticated context, org/team scope, capability, team organization ownership, and scoped move ownership before write. Tests cover forbidden access and cross-team ownership failures; RLS remains the database backstop. |

## Source Map

Primary route files:

- `app/(app)/team-standard-moves/page.tsx`
- `app/(app)/team-standard-moves/loading.tsx`
- `components/shared/page-skeletons.tsx`

Feature files:

- `features/standard-moves/actions.ts`
- `features/standard-moves/action-core.mjs`
- `features/standard-moves/action-core.test.mjs`
- `features/standard-moves/data.ts`
- `features/standard-moves/list-route-state.mjs`
- `features/standard-moves/list-route-state.test.mjs`
- `features/standard-moves/standard-moves-feedback.tsx`
- `features/standard-moves/standard-moves-form-dialogs.tsx`
- `features/standard-moves/standard-moves-results-retry.tsx`
- `features/standard-moves/standard-moves-table.tsx`
- `features/standard-moves/team-standard-moves-route-shell.tsx`
- `features/standard-moves/team-standard-moves-toolbar.tsx`

Shared/test support:

- `features/testing/server-action-harness.mjs`
- `lib/auth/capability-rules.mjs`
- `lib/validation/standard-moves.ts`
- `components/ui/sonner.tsx`
- `app/layout.tsx`

## Current Route Shape

The page remains server-first:

- Requires authenticated access before rendering.
- Resolves navigation scope from URL/search state.
- Keeps missing organization scope, missing team selection, and read-only access
  inline because they are persistent user-decision states.
- Computes management permission with the Team Sessions capability family.
- Resolves status feedback from URL params, then delegates transient display to
  `StandardMovesFeedback`.
- Loads stable chrome with `getTeamStandardMovesChromeData()`.
- Loads bounded result rows with `getTeamStandardMovesResultsData()` behind a
  nested `Suspense` boundary.
- Wraps the list in `TeamStandardMovesRouteShell` for client-side filter
  transitions and mobile/desktop create actions.

The route state contract is now explicit:

- `statusFilter`: accepts `active`, `archived`, or `all`; defaults to `active`.
- `page`: normalized to a positive integer.
- `loadMore=1`: mobile accumulated loading mode.
- Redirects preserve org/team scope, status filter, page, and load-more state.
- Page hrefs preserve current query state and remove stale `page/loadMore` when
  returning to page 1.

## Data And Loading Behavior

Current data path:

- Status counts use aggregate exact count queries for active and archived moves.
- Results use an explicit page size of 25.
- Desktop fetches one page at a time.
- Mobile `Load more` fetches accumulated pages from the beginning through the
  requested page.
- Usage counts are exact count queries only for visible standard move ids.
- Empty result paths return a stable pagination shape.

Current loading behavior:

- Route-level `loading.tsx` renders `TeamStandardMovesPageSkeleton`.
- Skeleton chrome mirrors the final mobile title/filter/FAB and desktop toolbar.
- Skeleton results mirror mobile cards, mobile `Load more`, desktop table
  headers, desktop rows, and desktop pagination.
- Filter transitions keep existing results mounted, dim/disable them, and show
  one centered local overlay spinner.
- Desktop page transitions keep the table mounted and show a table overlay
  spinner.
- Mobile load-more pending state stays in the `Load more standard moves` button.
- Nested results failure renders `StandardMovesResultsRetry` instead of
  collapsing the route.

## UI Behavior

Desktop:

- Renders the `Std. Moves` table.
- Keeps Status filtering in the toolbar.
- Keeps create in the toolbar as `New`.
- Uses a right Sheet for create/edit.
- Keeps row actions in the final right-aligned column.
- Keeps empty state inside the table body.
- Shows a disabled row action affordance for read-only users.
- Uses desktop pagination with Previous, page numbers, ellipses, and Next.

Mobile:

- Renders compact cards instead of table rows.
- Cards include name, description, usage count, updated time, status badge, and
  row action trigger.
- Status filtering opens in a bottom Drawer.
- Create uses one fixed `mobile-floating-action size-14` FAB.
- Create/edit use bottom Drawers.
- Drawer forms keep fixed header/footer and a single scrollable body.
- Drawer inputs and primary submit action use the current mobile sizing standard.
- Mobile pagination uses the accumulated `Load more standard moves` button.

Implementation note:

- The mobile and desktop create/filter open controls are controlled native
  buttons styled with shared button variants. This was kept intentionally
  hydration-stable for this route after browser smoke. Do not swap these back to
  a primitive trigger wrapper without a desktop and mobile browser smoke pass.

## Feedback Behavior

`StandardMovesFeedback` is now toast-only for transient action results:

- Imports `toast` from `sonner`.
- Emits `toast.success(statusMessage, { id })`.
- Emits `toast.error(errorMessage, { id })`.
- Uses stable ids keyed by route, status/error kind, and value:
  `team-standard-moves-feedback:${pathname}:status:${status}` and
  `team-standard-moves-feedback:${pathname}:error:${error}`.
- Removes consumed `status` and `error` params with
  `router.replace(..., { scroll: false })`.
- Returns `null`, so success/error feedback no longer occupies page layout
  space.
- Relies on the globally mounted bottom-center Sonner toaster; the route does
  not mount another `<Toaster>`.

Persistent states remain inline:

- No organization context.
- No selected team.
- Read-only permissions.

## Mutation And Security Behavior

`features/standard-moves/actions.ts` is now a thin server wrapper around
`features/standard-moves/action-core.mjs`.

Create:

- Validates name, optional description, org scope, team scope, status/page/load
  state.
- Checks authenticated context and management capability.
- Confirms the scoped team belongs to the scoped organization.
- Revives an existing same-name team move if found.
- Inserts a new `team_standard_moves` row otherwise.
- Preserves route state on success and failure redirects.

Update:

- Validates id, name, optional description, and preserved scope.
- Checks capability and team organization ownership.
- Confirms the standard move belongs to the scoped team before writing.
- Preserves route state on success and failure redirects.

Archive/restore:

- Validate id and preserved scope.
- Check capability and team organization ownership.
- Confirm scoped move ownership before toggling `is_active`.
- Preserve route state on success and failure redirects.

All mutations revalidate:

- `/team-standard-moves`
- `/team-sessions`
- `/team-camps`
- `/team-notes`

## Regression Coverage

Focused `node:test` coverage now exists for:

- Defensive status/page/load-more normalization.
- Desktop page href preservation.
- Mobile load-more href preservation.
- Action redirect builder preservation for create/update/archive/restore.
- Error redirect builder preservation.
- Create redirect preservation.
- Update redirect preservation.
- Archive redirect preservation.
- Restore redirect preservation.
- Forbidden create without Standard Move permission.
- Forbidden update without Standard Move permission.
- Cross-team update attempts.
- Cross-team archive attempts.
- Cross-team restore attempts.
- Stale team/organization scope.

Harness support added:

- `insert()` operations.
- `ilike()` filters.
- Insert error injection.
- Existing select/update redirect capture and revalidation capture remain.

## Pattern Compliance

### Loading Patterns

Matches:

- Route-level skeleton exists.
- Chrome/results data split is in place.
- Results are nested behind `Suspense`.
- Results failure has local retry.
- Filter/page transitions use secondary loading overlays.
- Load-more keeps existing mobile cards visible.
- Pending form state stays inside submitted buttons.
- Sonner toasts are used only for completion/error feedback.

Remaining gap:

- No local Standard Moves timing log exists yet.

### Mobile UI Patterns

Matches:

- Mobile cards replace tables.
- Primary create uses `mobile-floating-action size-14`.
- Mobile create/edit use bottom Drawers.
- Mobile Status filter uses a bottom Drawer.
- Drawer forms have fixed header/footer and one scrollable body.
- Drawer submit button is full width and `h-11`.
- Fieldsets disable while pending.
- Pending submit state shows spinner text.
- `Load more` is visible and keeps pending state in the button.
- Transient feedback uses Sonner, not inline layout banners.

Remaining note:

- Trigger implementation is a route-local controlled-button implementation for
  hydration stability. It still produces the expected Drawer/Sheet behavior and
  passed browser smoke.

### Desktop UI Patterns

Matches:

- Desktop uses a table.
- Status filter remains in the toolbar.
- Create/edit use right Sheet.
- Row actions are in the final column.
- Read-only action affordance stays visible but disabled.
- Empty state stays inside the table body.
- Desktop pagination is explicit.
- Pending page/filter transitions use local overlays.
- Sonner toasts replace transient inline banners.

Remaining gap:

- The active Status filter has no dedicated clear affordance. This is acceptable
  because `Active` is the default and the dropdown exposes all filter states.

## Browser Smoke

Authenticated production smoke was run against `npm run start` after a fresh
build.

Mobile 390x844:

- Signed in with the seeded test user.
- `/team-standard-moves` loaded authenticated content.
- Cards rendered with active moves.
- Status trigger rendered.
- Status Drawer opened with `Active`, `Archived`, `All`, and `Close`.
- Single `New standard move` FAB rendered.
- FAB opened the bottom `Create Std. Move` Drawer.
- Drawer showed `Name`, `Description`, and disabled `Create move`.
- Browser page errors were empty.

Desktop 1280x900:

- Desktop table rendered headers: `Name`, `Description`, `Used`, `Updated`,
  `Status`.
- Rows rendered active moves and row action buttons.
- Toolbar Status control rendered.
- Desktop `New` opened the right `Create Std. Move` Sheet.
- Sheet showed `Name`, `Description`, and disabled `Create move`.
- Browser page errors were empty.

Observed console note:

- Production smoke logged the local Vercel Speed Insights script-load message
  for `/_vercel/speed-insights/script.js`. This did not block route rendering or
  interaction and is expected in local `next start`.

## Current Risks

1. No Standard Moves-specific timing log exists yet. If this route becomes slow,
   add timing around scope resolution, chrome counts, result query, usage counts,
   and render payload size.
2. Usage counting is bounded but still issues one exact count query per visible
   move id. This is acceptable at page size 25, but a grouped SQL/RPC aggregate
   would be cleaner for very large teams.
3. Browser smoke showed that interaction should be tested after hydration in the
   production bundle. There were no page errors, but adding automated browser
   smoke would make this less manual.

## Next Engineering Priority

Step 5: Add Standard Moves list timing observability.

- Add a route-local timing helper similar to the newer list/detail timing
  patterns.
- Log scope resolution, chrome counts, result rows, usage counts, and total
  duration.
- Keep the log development-safe and low-noise.

Step 6: Replace visible-row usage count fanout when needed.

- Keep the current bounded count path while page size remains 25.
- If route timing shows usage counts dominating, add a grouped SQL/RPC aggregate
  for `session_standard_moves` by `team_standard_move_id`.
- Preserve the current `usageCount` output contract.

Step 7: Add automated browser smoke coverage.

- Cover authenticated mobile Status Drawer.
- Cover authenticated mobile FAB create Drawer.
- Cover authenticated desktop table.
- Cover authenticated desktop create Sheet.
- Keep this as smoke coverage, not a broad E2E suite.

Step 8: Revisit trigger primitive composition only if shared primitives stabilize.

- Current controlled native buttons are browser-verified and hydration-stable.
- If `DrawerTrigger`/`SheetTrigger` shared behavior changes, test both mobile
  and desktop before replacing these triggers.

## Validation Evidence

Latest implementation validation for this improvement batch:

- `./node_modules/.bin/eslint features/testing/server-action-harness.mjs features/standard-moves/action-core.mjs features/standard-moves/action-core.test.mjs features/standard-moves/actions.ts features/standard-moves/list-route-state.mjs features/standard-moves/list-route-state.test.mjs`
- `./node_modules/.bin/eslint features/standard-moves/standard-moves-form-dialogs.tsx features/standard-moves/team-standard-moves-toolbar.tsx`
- `node --test features/standard-moves/list-route-state.test.mjs features/standard-moves/action-core.test.mjs` passed, 16 tests.
- `./node_modules/.bin/tsc --noEmit`
- `npm test` passed, 96 tests.
- `npm run lint` passed with existing unrelated warnings in
  `app/sign-in/sign-in-content.tsx` and
  `features/onboarding/onboarding-flow.tsx`.
- `npm run build`
- Production browser smoke with `npm run start` passed for mobile Drawer/FAB and
  desktop Sheet/table paths.
- `git diff --check` and trailing-whitespace scan were clean for the audit
  refresh.
