# Loading Patterns

Source of truth for Sailog route loading, deferred content, skeletons, and
secondary pending states.

Current references: `/team-sessions`, `/team-sessions/[id]`,
`/team-camps/[id]`, `/team-standard-moves`, `/team-reports`, `/reports`,
and `/team-assessments/[id]`,
implemented by:

- `app/(app)/team-sessions/page.tsx`
- `app/(app)/team-sessions/loading.tsx`
- `app/(app)/team-sessions/[id]/page.tsx`
- `app/(app)/team-sessions/[id]/loading.tsx`
- `app/(app)/team-camps/[id]/page.tsx`
- `app/(app)/team-camps/[id]/loading.tsx`
- `app/(app)/team-standard-moves/page.tsx`
- `app/(app)/team-standard-moves/loading.tsx`
- `app/(app)/team-reports/page.tsx`
- `app/(app)/team-reports/loading.tsx`
- `app/(app)/reports/page.tsx`
- `app/(app)/reports/loading.tsx`
- `app/(app)/team-assessments/[id]/page.tsx`
- `app/(app)/team-assessments/[id]/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/sessions/team-sessions-route-shell.tsx`
- `features/sessions/data.ts`
- `features/sessions/sessions-table.tsx`
- `features/standard-moves/team-standard-moves-route-shell.tsx`
- `features/standard-moves/data.ts`
- `features/standard-moves/standard-moves-table.tsx`
- `features/reports/reports-route-shell.tsx`
- `features/reports/data.ts`
- `features/reports/reports-table.tsx`
- `features/sessions/session-detail-tabs-client.tsx`
- `features/camps/camp-detail-tabs-client.tsx`

## Principles

- Render stable chrome first: app header, page title, and fixed labels should
  appear before slower scoped data when the route can safely do so.
- Use App Router `loading.tsx` for route entry and `Suspense` for slower route
  sections.
- For list routes, do not put the entire toolbar/FAB/table inside one data
  boundary. Split stable list chrome from result rows/cards whenever the chrome
  can render from a smaller data shape.
- Defer data-heavy content such as KPIs, tabs, tables, cards, media lists, and
  catalogs.
- Skeletons should mirror the final surface, not invent a separate loading UI.
- Keep labels visible and skeletonize values. This makes the page feel anchored
  while data arrives.
- Use compact spinners only for micro-loading inside already mounted controls
  or buttons. Avoid replacing a whole panel with a generic spinner when the
  final layout is known.

## List Route Shell + Results Pattern

Use this for operational list routes where filters/actions should stay visible
while rows/cards load.

- Resolve auth and navigation scope in `page.tsx` before rendering the list
  surface.
- Split data into a chrome payload and a results payload. In Team Sessions this
  is `getTeamSessionsChromeData()` for filters/create options and
  `getTeamSessionsResultsData()` for rows, `pageCount`, and pagination flags.
  In Team Standard Moves, the same split is
  `getTeamStandardMovesChromeData()` for status counts and
  `getTeamStandardMovesResultsData()` for bounded rows and usage counts. In
  Reports, `/team-reports` uses `getTeamReportsChromeData()` for create
  options and `getTeamReportsResultsData()` for bounded report rows; `/reports`
  uses `getOrganizationReportsChromeData()` for filters and
  `getOrganizationReportsResultsData()` for bounded rows.
- Render a client route shell for stable controls. In Team Sessions this is
  `TeamSessionsRouteShell`, which owns title, filters, desktop `New`, mobile
  FAB, and filter-pending overlays.
- Put only the result area behind the nested results `Suspense` once chrome has
  resolved. In Team Sessions the boundary fallback is
  `TeamSessionsResultsSkeleton`.
- Keep the segment `loading.tsx` fallback as a full mirrored page skeleton for
  direct route entry. Compose it from the same chrome/results skeleton pieces
  used by the internal boundaries.
- During filter/page transitions, keep current rows/cards visible, disabled,
  and dimmed with one centered spinner. Keep load-more spinners inside the
  button and keep previous mobile cards mounted.
- Reports follows this with desktop table pagination, mobile accumulated
  `Load more reports`, organization filter overlay loading, and mirrored
  `TeamReportsResultsSkeleton` / `OrganizationReportsResultsSkeleton` fallbacks.

## Team Session Detail Pattern

- `page.tsx` resolves auth and navigation scope first.
- The static H1 (`Team Session`) renders immediately after scope is valid.
- Header actions load behind `Suspense` because they need session metadata.
- Summary cards/KPIs load behind `Suspense` with the same mobile divided-card
  and desktop four-card grid used by the final route.
- The selected tab payload loads behind a nested `Suspense`.
- Inactive tabs remain deferred and load through the scoped tab-data API when
  selected.
- Route-level `loading.tsx` uses the same skeleton pieces so direct navigation
  and in-route deferred loading feel consistent.

## Team Camp Detail Pattern

- `page.tsx` resolves auth and navigation scope first.
- Camp/venue chrome loads separately from KPI aggregation and selected-tab data,
  so the final desktop camp name and location badge can render before slower
  metrics, tables, and lists.
- Summary KPIs load behind `Suspense` with the same mobile divided-card and
  desktop four-card grid used by the final route.
- The selected tab payload loads in parallel with KPIs behind the same
  `Suspense` boundary.
- Sessions skeletons mirror the final shared Team Sessions surface: mobile
  toolbar/cards/FAB and desktop toolbar/table/pagination.
- Goals and Notes skeletons mirror their final rounded content panels instead
  of using a generic dashed loading block.
- Inactive Camp tabs keep using the scoped tab-data API when selected.

## Team Assessment Detail Pattern

- `page.tsx` resolves auth, navigation scope, feedback params, and manager
  capability first.
- The feedback and read-only scope message render outside the heavy detail
  boundary so route chrome can settle before assessment analytics load.
- The current assessment, comparison runs, answer matrix, and analytics payload
  load behind a nested `Suspense` boundary.
- The boundary fallback is `TeamAssessmentDetailDeferredContentSkeleton`, which
  keeps the final `Analytics` and `Answers` labels visible and skeletonizes
  only values, select triggers, chart area, and table/card rows.
- Route-level `loading.tsx` reuses `TeamAssessmentDetailPageSkeleton` so direct
  navigation and in-route deferred loading share the same analytics-first
  surface.

## Immediate Tab Switch Pattern

Use this for route-backed or API-backed tabs where selecting a tab requires
loading a new payload.

- Do not bind the tab value only to the server/search-param value if that makes
  the trigger wait for navigation to finish. Keep a local `selectedTab` state
  in the client tab shell.
- On tab click, update local `selectedTab` immediately, then start the URL/API
  transition with `router.push`, `window.history.replaceState`, or the scoped
  tab-data request used by that route.
- Render the newly selected tab right away. If its payload is not available yet,
  show the tab's mirrored panel skeleton inside the content area instead of
  leaving the previous tab selected.
- Keep the URL/search param as the reload/share source of truth. Sync local
  tab state back from the server-provided `initialTab`/`selectedTab` when the
  route entity changes or the navigation payload completes.
- Keep current loaded data cached per tab when the route already supports it,
  and show an in-panel retry state for deferred tab failures.

## Immediate Navigation Chrome Pattern

Use this for persistent app navigation where the selected menu item should
react immediately even if the destination route is cold.

- Keep route content bound to the committed URL, App Router `loading.tsx`,
  Suspense, and route data caches.
- Shared chrome may keep a short-lived local navigation intent and derive its
  active item from `pendingPathname ?? committedPathname`.
- Record the intent only for normal same-origin left-click navigations. Ignore
  modifier/new-tab clicks and query-only same-path transitions.
- Clear the local intent when `usePathname()` commits, and include a short
  safety reset so cancelled or failed navigations return to the committed route.
- Do not move route-specific headers, breadcrumbs, or data panels ahead of the
  committed route unless that route owns a separate immediate-switch contract.

## Skeleton Fidelity

- Desktop summary cards: keep the four-card grid and fixed labels.
- Mobile summary cards: keep the single divided `GradientCard` and fixed labels.
- Desktop tabs: keep the compact `h-10` tab row and all tab labels.
- Mobile tabs: keep the full-width `h-11` segmented row, with `More` when the
  final route uses overflow.
- Tables/lists: preserve row count, header/action columns, and mobile card
  shapes.
- Media and gear tabs should show list/card skeletons rather than text-only
  placeholders.

## Secondary Loading

- Filter/page transitions keep the current table/cards visible, disabled, and
  dimmed with one centered spinner.
- Load-more actions keep existing rows/cards visible and put the spinner in the
  button.
- Save actions show pending state inside the submitted button and keep the form
  surface stable.
- Deferred tab failures should show an in-panel retry state instead of collapsing
  the whole route.

## Route Feedback Toasts

- Transient server-action completion feedback should use the global Sonner
  toaster mounted once in `app/layout.tsx` at `bottom-center`.
- Use `toast.success()` for completed create/update/delete/archive/restore saves
  and `toast.error()` for action errors. Do not mount another `<Toaster>` in a
  route or feature component.
- Use stable toast ids keyed by route plus status/error value so reloads,
  refreshes, and client effects do not duplicate the same message.
- After emitting a URL-param-driven toast, remove the consumed `status`,
  `result`, and/or `error` params with `router.replace(..., { scroll: false })`.
- Keep pending feedback inside the submitted button or local loading surface.
  Completion toasts should confirm the result; they should not replace button
  spinners while a save is still in flight.
- Persistent state explanations such as missing scope, read-only access, and
  setup blockers should remain inline panels because they affect the user's next
  decision.

## Documentation Links

- Mobile sizing, drawers, tabs, loading, and card behavior live in
  `MOBILE_UI_PATTERNS.md`.
- Desktop headers, breadcrumbs, tables, and desktop loading fidelity live in
  `DESKTOP_UI_PATTERNS.md`.
