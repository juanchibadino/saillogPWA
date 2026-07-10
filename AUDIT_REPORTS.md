# Reports Audit

Date: 2026-07-10

Scope: current Reports list surfaces after normalization:

- Organization Reports: `/reports`
- Team Reports: `/team-reports`
- Shared Reports list components under `features/reports/*`

Out of scope: the Venue detail Reports tab at `/venues/[id]?tab=reports`.
That tab was already aligned with the Venue detail tab pattern: mobile cards,
desktop table, `Reports {year}` heading, mobile FAB, and mirrored skeletons.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`

## Executive State

Reports is now normalized with the current Sailog list-route standard.

Current result: 4.3/5.

The route now has:

- Server-first auth, scope, and permission checks before rendering the list.
- Split chrome/results loading for `/team-reports` and `/reports`.
- Results-only nested `Suspense` boundaries.
- Explicit page size via `REPORTS_PAGE_SIZE = 10`.
- Server-side pagination with clamped invalid pages.
- Desktop table inside `GradientCard` with a stable PDF action column.
- Desktop numbered pagination.
- Mobile report cards.
- Mobile accumulated `Load more reports`.
- Organization Reports mobile filter Drawer.
- Organization Reports desktop inline Year, Team, and Venue filters.
- Organization filter transitions that keep current rows/cards mounted and show
  one local overlay spinner.
- Team Reports desktop create action in the title row.
- Team Reports mobile create `mobile-floating-action size-14` FAB.
- Team Reports mobile create Drawer with fixed header/footer and scrollable
  form body.
- Create submit buttons with disabled pending state and spinner text.
- Sonner success/error feedback for transient report creation results.
- Mirrored route and nested skeletons for mobile cards and desktop tables.
- Focused route-state tests for `page` and mobile `loadMore`.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance | 4.1/5 | Reports now fetch bounded result rows instead of rendering all rows in one payload. Chrome and results load separately. Remaining opportunity: add timing logs and route-cache refresh like the highest-traffic list routes if reports volume grows. |
| UI consistency | 4.5/5 | Mobile cards, desktop table, mobile filters Drawer, desktop inline filters, mobile FAB, Drawer create flow, pending buttons, and skeletons now match the shared pattern docs. |
| Code tidiness | 4.2/5 | Route state, chrome/results data, shell, table, feedback, and forms are separated. The shared report form file is larger than ideal because it supports venue-detail and team-list creation variants. |
| Scalability | 4.1/5 | Results use `REPORTS_PAGE_SIZE = 10`, filtered counts, desktop page numbers, and mobile accumulated loading. Camp-name hydration is bounded to visible report rows. |
| Best practices | 4.4/5 | Server-side permission checks, route-state normalization, nested `Suspense`, local secondary loading, Sonner feedback cleanup, disabled fieldsets, and pending submit buttons are in place. |
| Accessibility | 4.3/5 | Mobile icon download actions have `aria-label`, filter and page loading expose status labels, and pagination labels are concrete. Report rows are not navigational rows, so PDF stays as the explicit action. |

## Source Map

Route entry points:

- `app/(app)/reports/page.tsx`
- `app/(app)/reports/loading.tsx`
- `app/(app)/team-reports/page.tsx`
- `app/(app)/team-reports/loading.tsx`

Shared Reports files:

- `features/reports/data.ts`
- `features/reports/list-route-state.mjs`
- `features/reports/list-route-state.test.mjs`
- `features/reports/reports-route-shell.tsx`
- `features/reports/reports-table.tsx`
- `features/reports/reports-feedback.tsx`
- `features/reports/report-form-dialogs.tsx`
- `features/reports/actions.ts`

Shared loading:

- `components/shared/page-skeletons.tsx`

## Before Audit Findings

`/reports`:

- Loaded filters and report rows through one monolithic page payload.
- Rendered mobile and desktop as the same table surface.
- Had no mobile filter Drawer.
- Had no explicit route-state helper for `page` or `loadMore`.
- Had no desktop pagination or mobile accumulated loading.
- Route loading skeleton did not mirror the final mobile card and desktop table
  split.

`/team-reports`:

- Loaded create options and every report row in one payload.
- Rendered mobile and desktop as the same table surface.
- Used an inline mobile `New` button instead of the standard Reports FAB.
- Opened create only as a desktop-style Dialog.
- Showed transient create success/error as inline banners.
- Submit buttons did not show pending spinner text.
- Route loading skeleton still represented the old create-card/list layout.

## Current Route Shape

`/reports` now resolves authenticated organization access and admin capability
first. It then starts `getOrganizationReportsChromeData()` for Year, Team, and
Venue filter chrome. Once chrome resolves, only the results section is placed
behind `OrganizationReportsResultsSkeleton` and loaded with
`getOrganizationReportsResultsData()`.

`/team-reports` now resolves authenticated team scope first, keeps read-only
access inline, then starts `getTeamReportsChromeData()` for create options.
Only the report rows load behind `TeamReportsResultsSkeleton` with
`getTeamReportsResultsData()`.

Both routes use `resolveReportsListRequest()` for `page` and `loadMore=1`.
Desktop pagination removes `loadMore`; mobile `Load more reports` preserves it.

## UI Behavior

Desktop:

- Organization Reports show `Reports` with inline Year, Team, and Venue filters.
- Team Reports show `Reports` with `New` in the title row when the user can
  create reports.
- Report rows render in a `GradientCard` table with fixed headers and a final
  PDF column.
- Empty state stays inside the table body.
- Page transitions keep the table mounted, dimmed, and overlaid with one
  spinner.

Mobile:

- Organization Reports show a `Filters` button that opens a bottom Drawer.
- Team Reports create uses one `mobile-floating-action size-14` FAB.
- Report rows render as compact cards with report name, team when relevant,
  venue, camp count, camp names, created time, and an icon-only PDF download
  action.
- Mobile pagination uses a full-width `h-11` `Load more reports` button.
- Create uses a bottom Drawer with fixed header/footer and a scrollable body.

## Remaining Risks

- Reports does not yet use the scoped route-cache refresh layer used by some
  higher-traffic routes. That is acceptable for the current bounded results
  path, but it is the next performance lever if Reports becomes a frequent
  operational route.
- `features/reports/report-form-dialogs.tsx` now supports two create contexts.
  It is still coherent, but future report creation variants should split the
  forms before adding another branch.
- Organization Reports filter options are server-refreshed after Apply. That
  keeps the route state simple; dependent Team-to-Venue filtering is not live
  inside the open Drawer until the route refreshes.

## Validation

- `node --test features/reports/list-route-state.test.mjs`
- `npx tsc --noEmit --pretty false`
