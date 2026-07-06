# Team Venue List Audit

Date: 2026-07-06

Scope: current `/team-venues` list implementation after the Step 1-5
enhancements. This audit is centered on `app/(app)/team-venues/page.tsx` and
the supporting Team Venue list modules.

This audit is separate from `AUDIT_TEAM_VENUE_ID.MD`, which tracks the Team
Venue detail surface. The real detail route navigated from this list is still
`/venues/[id]`, where `id` is the `team_venues.id`.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`
- Reference list audits: `AUDIT_TEAM_CAMP.MD` and `AUDIT_TEAM_SESSION.MD`
- Reference detail audits for downstream contrast:
  `AUDIT_TEAM_CAMP_ID.MD` and `AUDIT_TEAM_SESSION_ID.MD`

## Snapshot Register

### Foto actual

- The page is server-first and requires authenticated access before resolving
  navigation scope.
- Missing organization scope and missing team scope render warning panels before
  the list surface.
- Route state is normalized through `features/team-venues/list-route-state.mjs`
  for `status`, `page`, and `loadMore`.
- The route now logs `team_venues_list_timing` phases for `scope`,
  `chrome/catalog`, `results`, and `camp counts`.
- The list is split into stable chrome and nested results:
  `getTeamVenuesChromeData()` loads status counts, linked venue options, and
  available create/link options.
- `getTeamVenuesResultsData()` owns filtered visible rows, pagination metadata,
  current-year camp metrics, and total camp counts for delete rules.
- `TeamVenuesRouteShell` keeps filter/create chrome mounted while nested results
  load or retry.
- `TeamVenuesPageSkeleton` is now composed from `TeamVenuesChromeSkeleton` and
  `TeamVenuesResultsSkeleton`.
- Desktop renders a table with numbered pagination.
- Mobile renders tappable cards with accumulated `Load more venues`.
- Row/card hover and focus prefetch the venue detail route.
- Row/card navigation shows a local spinner while the detail navigation is
  pending.
- Status filter transitions keep current rows/cards visible and add one local
  secondary loading overlay.
- Create and edit use the current form standard: desktop right Sheet, mobile
  bottom Drawer, fixed header/footer, scrollable body, disabled fieldset, and
  submit spinner labels.
- Mobile create is a single `mobile-floating-action size-14` FAB.
- Delete uses a Dialog, preserves route state on redirect, and blocks delete
  when linked camps exist.
- Visible management UI and Server Actions now share the same permission rule:
  selected-team active membership, with super admin as platform override.
- Focused tests cover route-state normalization, pagination hrefs, redirect
  preservation, forbidden write actions, and linked-camp delete blocks.
- If the nested results load fails, the chrome remains visible and the results
  area renders a local retry action that calls `router.refresh()`.

### Target state

The Step 1-5 target is materially implemented. The route now matches the
current Team Sessions and Team Camps list standard on these major behaviors:

- Stable list chrome rendered before slower rows/cards.
- Split chrome/results data loaders.
- Results-only `Suspense` boundary with route and nested skeletons.
- Explicit page size, desktop numbered pagination, and mobile accumulated
  `Load more venues`.
- Mounted filters and action controls during transitions, with one local
  table/card overlay spinner.
- Mobile primary create action as a FAB.
- Desktop right Sheet and mobile Drawer for create/edit.
- Fixed form header/footer, scrollable body, disabled fieldset, and pending
  submit labels.
- Server-first permission checks aligned with the visible UI.
- Focused route-state and permission tests.
- JSON timing logs plus a local results retry path.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.2/5 | The route resolves auth/scope first, streams chrome and results separately, pages visible rows, supports mobile accumulation, keeps current rows visible during transitions, and emits timing logs by phase. Remaining pressure points are full linked-venue and organization venue catalog reads in chrome, plus camp metrics loaded as rows rather than aggregate counts. |
| UI consistency | 4.4/5 | Desktop table, mobile cards, Status Drawer/dropdown, mobile FAB, Sheet/Drawer forms, fixed footers, submit spinners, secondary loading overlays, desktop pagination, mobile load-more, prefetch, and local navigation spinners now match the newer Sailog list standard. Remaining small gaps are desktop clear-filter affordance polish and mobile cards not exposing the camp-count metric shown on desktop. |
| Code tidiness | 4.0/5 | Route state, shell, toolbar, timing, chrome data, results data, and action rules are now split into named modules. The main remaining maintainability issue is that `team-venues-table.tsx` still owns table/cards plus create/edit/delete form surfaces, so it is large even though behavior is now cleaner. |
| Scalability | 4.0/5 | Results are page-bounded with `TEAM_VENUES_PAGE_SIZE`, desktop page numbers, and mobile accumulation. Camp counts are limited to visible team venues. The main scale risks are repeated full catalog reads for chrome and row-based camp counting instead of database aggregate counts. |
| Best practices | 4.5/5 | The route now uses nested `Suspense`, local secondary loading, `useTransition`, `useFormStatus()`, disabled fieldsets, server-side authorization, Zod validation, redirect preservation, focused tests, observability, and local retry. Residual risk is mostly around further data-query optimization and table/form component decomposition. |
| Modularity | 4.1/5 | The route now has `TeamVenuesRouteShell`, `TeamVenuesToolbar`, `list-route-state.mjs`, `list-timing.ts`, `action-rules.mjs`, split chrome/results data, and split skeleton pieces. The largest missing modular cut is extracting create/edit/delete form surfaces out of `team-venues-table.tsx`. |
| Security | 4.5/5 | Server Actions recheck authenticated context, active team scope, team existence in organization, selected-team write permission, venue ownership, team-venue ownership, and linked-camp delete constraints. Tests assert that active selected-team members can write and organization-admin-only users cannot. Super admin remains a platform override. |

Overall: 4.25/5. `/team-venues` is now aligned with the current Sailog
list-route standard. The route is no longer a monolithic load-and-render list;
the remaining work is targeted data optimization and component-size cleanup.

## Current Architecture

Entry points:

- `app/(app)/team-venues/page.tsx`
- `app/(app)/team-venues/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/team-venues/data.ts`
- `features/team-venues/list-route-state.mjs`
- `features/team-venues/list-route-state.test.mjs`
- `features/team-venues/list-timing.ts`
- `features/team-venues/action-rules.mjs`
- `features/team-venues/team-venues-route-shell.tsx`
- `features/team-venues/team-venues-toolbar.tsx`
- `features/team-venues/team-venues-results-retry.tsx`
- `features/team-venues/team-venues-table.tsx`
- `features/team-venues/team-venues-feedback.tsx`
- `features/team-venues/actions.ts`
- `features/venues/navigation.ts`
- `lib/auth/capabilities.ts`
- `lib/auth/capability-rules.mjs`
- `lib/validation/team-venues.ts`

Data behavior:

- The page resolves authenticated context and navigation scope first.
- `status`, `page`, and `loadMore` are normalized by the route-state helper.
- `status` supports `active` and `deprecated`; invalid values fall back to
  `active`.
- Chrome data reads every team-venue link for the active team and every venue in
  the active organization to resolve linked venue labels, build status counts,
  and build unlinked create options.
- Results data filters linked venues by active/deprecated state, resolves the
  bounded page, and returns only visible rows.
- `TEAM_VENUES_PAGE_SIZE` is `25`.
- Current-year camp counts and total camp counts are loaded only for visible
  team venues.
- Timing logs include metadata for requested page, load-more mode, filter,
  visible row count, catalog counts, and camp-count row totals.

UI behavior:

- `TeamVenuesRouteShell` owns stable list chrome and filter navigation state.
- Desktop shows a table with Venue, Location, current-year camp count, row
  actions, and numbered pagination.
- Desktop venue names are real links, while the full row remains keyboard and
  pointer navigable.
- Mobile shows compact cards with row-click navigation to Venue detail and a
  touch-sized action affordance.
- Mobile accumulates cards through `Load more venues` with `loadMore=1`.
- Row/card hover and focus prefetch detail routes.
- Row/card navigation swaps the action affordance for a local spinner on the
  row being opened.
- Status changes keep the current result list visible and dimmed while the next
  route state loads.
- Desktop create/edit surfaces are right Sheets.
- Mobile create/edit surfaces are bottom Drawers.
- Shared form bodies use fixed headers, scrollable content, fixed footers,
  disabled fieldsets, and spinner submit labels.
- Mobile create is a single floating action button.
- The nested results failure state renders `TeamVenuesResultsRetry` instead of
  collapsing the entire chrome.

Mutation behavior:

- `createTeamVenueLinkAction()` validates venue input, active team scope,
  selected-team write permission, organization ownership of the venue,
  duplicate-link errors, and redirects back to `/team-venues` with preserved
  route state.
- `createAndLinkTeamVenueAction()` validates venue data, active team scope,
  selected-team write permission, creates a venue, then links it to the active
  team.
- `updateTeamVenueAction()` validates input, active team scope, selected-team
  write permission, team-venue ownership, and updates the underlying `venues`
  row.
- `deleteTeamVenueAction()` validates input, active team scope, selected-team
  write permission, team-venue ownership, linked-camp absence, and deletes the
  `team_venues` row.
- Mutations preserve `org`, `team`, `status`, `page`, and `loadMore` where
  applicable.
- Mutations revalidate `/team-venues`, `/venues`, and downstream Camp/Session
  paths where relevant.

## Loading Patterns Comparison

Matches:

- The route has `app/(app)/team-venues/loading.tsx`.
- `loading.tsx` uses the shared `TeamVenuesPageSkeleton`.
- The page skeleton is split into chrome and results skeleton pieces.
- The route keeps feedback and warnings outside the list loading boundary.
- Chrome and results data are split.
- Results load behind a nested `Suspense` fallback.
- Status/page transitions keep the mounted rows visible with a local overlay.
- Failed nested results can retry locally without replacing the whole route.

Remaining gaps:

- Chrome still depends on full team venue and organization venue catalog reads.
- Camp metrics still count rows in application code instead of using aggregate
  database count queries.

## Mobile UI Standards Comparison

Matches:

- Mobile uses cards instead of table rows.
- Mobile cards are tappable and keyboard accessible.
- Row/card actions stop propagation.
- The Status filter opens in a Drawer with touch-sized controls.
- Create/edit surfaces use bottom Drawers.
- Mobile create uses one floating action button.
- Forms use one-column mobile layout, fixed footer, visible submit action, and
  `h-11` controls where needed.
- Mobile pagination is accumulated with `Load more venues`.
- Navigation and load-more actions show pending state.

Remaining gaps:

- Mobile cards still omit the current-year camp count shown in the desktop
  table.
- Delete remains a Dialog rather than a mobile-specific confirmation Drawer.
  This is acceptable for now but is less tailored than create/edit.

## Desktop UI Standards Comparison

Matches:

- Desktop uses a table.
- The filter is in the toolbar.
- Row actions are in the right-aligned final column.
- Empty state lives inside the table body.
- Rows support keyboard navigation.
- Venue names are rendered as links.
- Read-only rows keep a disabled action affordance.
- Desktop has numbered pagination.
- Desktop create/edit uses the right Sheet pattern.
- Table/page transitions show a single centered spinner overlay.
- Detail navigation prefetches on hover/focus.

Remaining gaps:

- The desktop active Status filter still lacks a dedicated clear-`X` affordance.
- The table/card component still contains substantial form surface code.

## Team Camp / Team Session Cross-check

Team Venue now matches the major `/team-sessions` and `/team-camps` list route
patterns:

- Route shell component for stable chrome.
- Split chrome/results data loaders.
- Results-only `Suspense`.
- Count-backed desktop pagination metadata.
- Mobile accumulation with `Load more`.
- Local filter/page/navigation pending overlays.
- Timing logs.
- Route-state helper and tests.
- Responsive Sheet/Drawer form surfaces with fixed footers and pending submit
  feedback.

Differences to keep visible:

- Team Venue chrome must still load the organization venue catalog because the
  create/link surface needs unlinked venue options.
- Team Venue delete protection depends on total linked camp counts.
- Team Venue detail still lives at `/venues/[id]`, not `/team-venues/[id]`.

## Current Risks

1. Full team-venue and organization venue catalog reads still happen in chrome,
   even when the visible result page is small.
2. Camp counts are still row-derived instead of database aggregate counts.
3. `team-venues-table.tsx` remains large because it contains table/card
   rendering plus create/edit/delete form surfaces.
4. The mobile card omits the camp-count metric visible on desktop, which can
   create a small information mismatch.
5. Super admin remains a platform override for Team Venue writes; if the product
   wants literal active-team-members-only with no platform override, the
   capability helper needs one more policy adjustment.

## Completed Enhancements

Step 1: Split list chrome and results.

- Added route-state helper for `status`, `page`, and `loadMore`.
- Added `getTeamVenuesChromeData()` for status counts and create/filter
  options.
- Added `getTeamVenuesResultsData()` for visible rows, counts, pagination, and
  camp metrics.
- Added `TeamVenuesRouteShell` and reused it from `page.tsx`.
- Refactored `TeamVenuesPageSkeleton` into chrome/results pieces.

Step 2: Add list pagination and secondary loading.

- Introduced `TEAM_VENUES_PAGE_SIZE`.
- Added desktop numbered pagination.
- Added mobile accumulated `Load more venues`.
- Kept current rows/cards visible while filters/pages transition.
- Added row/card prefetch on hover/focus and local navigation spinner.

Step 3: Replace create/edit surfaces with current form standard.

- Desktop now uses right Sheet.
- Mobile now uses bottom Drawer.
- Create/edit share form body logic.
- Added fixed header/footer, scrollable body, disabled fieldset, and submit
  spinners.
- Moved mobile create to a single FAB.

Step 4: Harden permissions and tests.

- Implemented the selected-team active membership rule for Team Venue writes,
  with super admin as platform override.
- Server Actions and visible UI now call the same capability rule.
- Added focused tests for status normalization, pagination hrefs, redirect
  preservation, forbidden create/link/update/delete, and linked-camp delete
  blocks.

Step 5: Add observability and retry behavior.

- Added `team_venues_list_timing` phases for scope, chrome/catalog, results, and
  camp counts.
- Added a local results retry path if the nested results load fails.

## Next Engineering Priority

Step 6: Optimize remaining data pressure.

- Replace row-loaded camp metrics with aggregate count queries where Supabase
  support is clean and typed.
- Consider separating the create/link venue catalog from default chrome if
  organization venue catalogs become large.
- Add timing thresholds or dashboards around `team_venues_list_timing` once
  production data confirms the slowest phase.

Step 7: Reduce component size.

- Extract create/link form surfaces from `team-venues-table.tsx`.
- Extract edit and delete surfaces from `team-venues-table.tsx`.
- Keep table/cards focused on list rendering, pagination, prefetch, and
  navigation pending state.

Step 8: Finish small UX parity gaps.

- Show current-year camp count on mobile cards if operations need the same
  metric on mobile.
- Add the desktop active-filter clear affordance if the shared toolbar pattern
  standardizes it.
- Decide whether delete confirmation should stay Dialog-based or get a
  mobile-specific Drawer treatment.

## Validation

- Audit source review completed against:
  - `app/(app)/team-venues/page.tsx`
  - `app/(app)/team-venues/loading.tsx`
  - `components/shared/page-skeletons.tsx`
  - `features/team-venues/actions.ts`
  - `features/team-venues/action-rules.mjs`
  - `features/team-venues/data.ts`
  - `features/team-venues/list-route-state.mjs`
  - `features/team-venues/list-route-state.test.mjs`
  - `features/team-venues/list-timing.ts`
  - `features/team-venues/team-venues-feedback.tsx`
  - `features/team-venues/team-venues-results-retry.tsx`
  - `features/team-venues/team-venues-route-shell.tsx`
  - `features/team-venues/team-venues-table.tsx`
  - `features/team-venues/team-venues-toolbar.tsx`
  - `features/venues/navigation.ts`
  - `lib/auth/capabilities.ts`
  - `lib/auth/capability-rules.mjs`
  - `LOADING_PATTERNS.md`
  - `MOBILE_UI_PATTERNS.md`
  - `DESKTOP_UI_PATTERNS.md`
  - `AUDIT_TEAM_CAMP.MD`
  - `AUDIT_TEAM_SESSION.MD`
- Latest implementation validation already run during Step 5:
  - `./node_modules/.bin/tsc --noEmit`
  - `npm test`
  - `npm run lint`
  - `git diff --check` on Team Venue Step 5 files
  - `npm run build`
  - Browser smoke against `/team-venues`, which redirected to `/sign-in` and
    rendered without a framework overlay.
- This audit refresh is documentation-only; validation for the edit was
  `git diff --check -- AUDIT_TEAM_VENUE.MD` plus a direct trailing-whitespace
  scan on `AUDIT_TEAM_VENUE.MD`.
