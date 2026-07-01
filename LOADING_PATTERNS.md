# Loading Patterns

Source of truth for Sailog route loading, deferred content, skeletons, and
secondary pending states.

Current references: `/team-sessions/[id]` and `/team-camps/[id]`, implemented by:

- `app/(app)/team-sessions/[id]/page.tsx`
- `app/(app)/team-sessions/[id]/loading.tsx`
- `app/(app)/team-camps/[id]/page.tsx`
- `app/(app)/team-camps/[id]/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/sessions/session-detail-tabs-client.tsx`
- `features/camps/camp-detail-tabs-client.tsx`

## Principles

- Render stable chrome first: app header, page title, and fixed labels should
  appear before slower scoped data when the route can safely do so.
- Use App Router `loading.tsx` for route entry and `Suspense` for slower route
  sections.
- Defer data-heavy content such as KPIs, tabs, tables, cards, media lists, and
  catalogs.
- Skeletons should mirror the final surface, not invent a separate loading UI.
- Keep labels visible and skeletonize values. This makes the page feel anchored
  while data arrives.
- Use compact spinners only for micro-loading inside already mounted controls
  or buttons. Avoid replacing a whole panel with a generic spinner when the
  final layout is known.

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

## Documentation Links

- Mobile sizing, drawers, tabs, and card behavior live in
  `MOBILE_UI_PATTERNS.md` and `MOBILE_CARD_LIST_UI.md`.
- Desktop headers, breadcrumbs, tables, and desktop loading fidelity live in
  `DESKTOP_UI_PATTERNS.md`.
