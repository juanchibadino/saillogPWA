# Desktop UI Patterns

Source of truth for Sailog desktop operational screens. This file replaces the
older `TABLE_DESKTOP_PATTERNS_UI.md` name so desktop guidance can include
headers, breadcrumbs, loading surfaces, and tables in one place.

Primary table reference: `/team-sessions`, implemented by:

- `app/(app)/team-sessions/page.tsx`
- `features/sessions/data.ts`
- `features/sessions/sessions-table.tsx`
- `features/sessions/team-sessions-toolbar.tsx`

Reports table reference: `/team-reports` and `/reports`, implemented by:

- `app/(app)/team-reports/page.tsx`
- `app/(app)/reports/page.tsx`
- `features/reports/data.ts`
- `features/reports/reports-route-shell.tsx`
- `features/reports/reports-table.tsx`

Use this with `MOBILE_UI_PATTERNS.md`: desktop uses tables, mobile uses cards.

## Header And Breadcrumbs

- Desktop app chrome owns route context. Use `components/site-header.tsx` for
  parent breadcrumbs instead of duplicating that context inside page content.
- Detail routes must show the stable parent chain, not a generic section label.
  Team Camp detail uses `[Team Name] > [Venue Name] > [Camp Name]`.
- The current breadcrumb item should be the object name, not a category label.
  Parent breadcrumbs should be links when the destination is known.
- Do not render placeholders such as `Venue` as final breadcrumb values on
  detail routes. Wait for the scoped breadcrumb payload or render the generic
  section title until real parent data exists.
- Keep page-level H1 focused on the current object. For Team Camp detail,
  desktop content uses `[Camp Name]` and a badge with `[Location]`.
- Supporting badges should be compact and factual. Avoid repeating the same
  parent context already shown in the desktop breadcrumb.

## Loading And Immediate Chrome

- Headers and titles should appear as early as possible, before slower detail
  payloads when the route can safely render static chrome.
- Defer KPIs, tables/lists, and tab panels behind `Suspense` when those payloads
  require scoped data.
- Skeletons should keep the desktop dimensions of the final surface: table
  headers, row grid tracks, action columns, pagination, tab rows, and summary
  card grids should not shift after data arrives.
- For secondary data loads inside an already mounted route, keep the existing
  table/list visible and use one local loading state.

## Structure

- Keep the route page server-first: auth, scope resolution, permissions, filters,
  and data loading belong in the route/data layer.
- Keep the interactive table in a focused client component.
- Use a compact title row above the table: left-aligned `h2` title on desktop,
  toolbar/actions on the right.
- Wrap the table in the local framed surface, currently `GradientCard` with
  `overflow-hidden p-0`.
- Do not nest cards inside the table container.

## Data And Performance

- Never load the full dataset only to paginate in the browser.
- Use explicit page size. `/team-sessions` uses `TEAM_SESSIONS_PAGE_SIZE = 10`.
- Query only the current page of rows.
- Fetch a filtered count only when numbered pagination needs `pageCount`.
- Clamp invalid requested pages to a valid page server-side.
- Keep filters in the URL so refresh, back/forward, and shared links preserve
  the same table state.
- Preserve scope params on every generated href.
- Prefetch row detail routes on hover/focus when detail navigation is common.
- Avoid client caches for the primary table unless the screen has a real
  stale-while-revalidate need. Prefer server data as the initial truth.

## Filters

- Desktop filters live inline in the toolbar.
- Filters should be grouped and compact, using dropdown/select controls instead
  of spreading separate controls across the page.
- Changing filters resets pagination unless a product rule says otherwise.
- Active filter controls should expose a right-side `X` clear action that
  removes only that filter while preserving the other active filters.
- Filter changes should reuse the table-centered loading overlay: disable and
  dim the table, disable filter and pagination controls, and show one centered
  spinner over the table.
- Filter labels must match the domain vocabulary of the screen.
- Empty filter options should disable the control instead of rendering a dead
  dropdown.

## Title

- Use one short visible title for the table section, such as `Sessions`.
- Do not add explanatory text above operational tables unless it changes an
  operator decision.
- The route header/breadcrumb owns page-level context; the table title owns the
  data region.

## Pagination

- Desktop pagination uses page numbers, active state, Previous, Next, and
  ellipses for larger page counts.
- Active page must use `aria-current="page"`.
- Page and filter transitions should show one visible loading state only: a
  centered spinner over the table.
- While a page or filter transition is pending, mark the pagination nav and the
  table surface with `aria-busy`.
- Disable pagination controls while the transition is pending to prevent
  duplicate navigations. Do not add extra spinners to page-number,
  Previous/Next, or filter buttons.
- Preserve filters and scope when building page URLs.
- Remove `loadMore` from desktop page links. `loadMore=1` is mobile-only.

## Actions

- Primary table-level action stays in the toolbar on desktop.
- Row actions belong in the final right-aligned column.
- Editing on desktop should use the established Dialog or right Sheet pattern,
  depending on the screen.
- Destructive or secondary actions should live behind a menu when space is
  tight.
- Read-only users should see disabled or unavailable actions, not hidden
  permissions that make the row layout jump.

## Feedback And Toasts

- Transient server-action completion feedback should use the global Sonner
  toaster mounted once in `app/layout.tsx` at `bottom-center`.
- Use `toast.success()` and `toast.error()` for create, update, delete,
  archive, and restore results. Do not render success/error banners above
  operational tables when the message is only confirming a completed action.
- Use stable toast ids keyed by route plus status/error value, then remove the
  consumed URL params with `router.replace(..., { scroll: false })`.
- Pending state remains local to the submitted button, row action, table overlay,
  or pagination control. Do not replace desktop pending states with loading
  toasts.
- Persistent warnings such as missing scope, read-only access, and setup blockers
  stay inline above the table.

## States

- Empty state lives inside the table body and spans all columns.
- Permission and missing-scope warnings live above the table, not inside every
  row.
- Row navigation shows a small spinner in the row action area and may reduce row
  opacity.
- Save/create flows show pending state inside the submitted action.
- Pagination and filter loading disables and dims the current table while a
  centered spinner overlays the table. Do not replace the whole table or clear
  rows.
- Avoid layout shifts: keep table headers, columns, and pagination dimensions
  stable while loading.

## Accessibility

- Rows that navigate should support click plus keyboard Enter/Space.
- Use real links for visible primary row labels when possible.
- Buttons need explicit `aria-label` when text is not enough.
- Keep pagination labels concrete: `Go to page 2`, `Go to next page`.
- The table overlay spinner should expose a status label such as
  `Loading sessions page`.
- Do not rely on color alone for states such as highlighted rows.

## Current `/team-sessions` Notes

- Desktop rows are paginated at 10 per page.
- The data layer returns `pageCount`, `currentPage`, `hasPreviousPage`, and
  `hasNextPage`.
- The desktop paginator renders page numbers, disables controls while moving
  from one page to another or changing filters, and shows one centered spinner
  over the disabled table.
- Detail navigation is prefetched on row hover/focus.
- Filters are Venue, Camp, and Highlight, all preserving navigation scope and
  exposing a right-side clear `X` when active.
- Mobile keeps a separate accumulated `Load more sessions` behavior.

## Current Reports Notes

- `/team-reports` and `/reports` use `REPORTS_PAGE_SIZE = 10`.
- Desktop renders a table in a `GradientCard` with a stable download action
  column.
- Desktop pagination uses Previous, page numbers, ellipses, and Next.
- Organization Reports keep Year, Team, and Venue filters inline on desktop;
  filter changes reset pagination and keep the current table visible behind a
  single overlay spinner.
- Mobile uses Reports cards plus accumulated `Load more reports`.
- Team Reports create stays in the desktop toolbar and uses the mobile FAB plus
  Drawer path on mobile.
