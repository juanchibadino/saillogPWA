# Venues List Audit

Date: 2026-07-16

Scope: current organization Venue catalog route after Steps 1 through 5:

- `app/(app)/venues/page.tsx`
- `app/(app)/venues/loading.tsx`
- `features/venues/list-route-state.mjs`
- `features/venues/list-route-state.test.mjs`
- `features/venues/data.ts`
- `features/venues/venues-route-shell.tsx`
- `features/venues/venues-table.tsx`
- `features/venues/venue-form-dialogs.tsx`
- `features/venues/actions.ts`
- `features/venues/venues-feedback.tsx`
- `components/shared/page-skeletons.tsx`

Route identity note: `/venues` is the organization-level Venue catalog. It is
separate from `/team-venues`, which tracks team-linked venues, and separate from
`/venues/[teamVenueId]`, which is the Team Venue detail route.

Out of scope: Team Venue list behavior in `AUDIT_TEAM_VENUE.MD`, Team Venue
detail behavior in `AUDIT_TEAM_VENUE_ID.MD`, and the deferred tab-data API used
by `/venues/[teamVenueId]`.

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`
- Reference org-list audit: `AUDIT_REPORTS.md`
- Reference team-list audits: `AUDIT_TEAM_VENUE.MD`,
  `AUDIT_TEAM_CAMP.MD`, and `AUDIT_TEAM_SESSION.MD`

## Snapshot Register

### Foto actual

- The page is server-first and requires authenticated access before resolving
  organization route access.
- `/venues` correctly uses `requireOrganizationRouteAccess()`, so coach/crew
  users without organization-route capability are redirected back to Team Home.
- Missing scope and missing active organization render inline warning panels.
- Create/update completion feedback uses `VenuesFeedback`, Sonner toasts, stable
  toast ids, and removes consumed URL params.
- The route includes `FreeTierQuotaDialog` for quota/payment feedback.
- `features/venues/list-route-state.mjs` now normalizes `page`, `loadMore`,
  and `venueStatus`.
- The list filter uses `venueStatus` instead of `status` so it does not collide
  with action feedback URLs such as `status=created` and `status=updated`.
- `venueStatus` supports `all`, `active`, and `inactive`, defaulting to `all`
  to preserve the historical route behavior of showing every organization
  venue.
- `VENUES_PAGE_SIZE` is `25`.
- `getVenuesChromeData()` loads status counts and create-form organization
  options for the active organization.
- `getVenuesResultsData()` uses a filtered count, clamps the requested page,
  fetches only the visible venue rows, and only loads `team_venues` plus team
  names for those visible rows.
- `getVenuePageData()` remains as a compatibility loader, but the route now uses
  split chrome/results data.
- `app/(app)/venues/page.tsx` renders feedback, quota, and read-only warnings
  outside the list data boundary.
- `VenuesRouteShell` keeps the title, status filter, and create action mounted
  while result rows load.
- The results area has a nested `Suspense` fallback through
  `VenuesResultsSkeleton`.
- Route loading now composes `VenuesChromeSkeleton` and
  `VenuesResultsSkeleton`.
- Desktop has numbered pagination and a centered page-transition spinner.
- Mobile renders venue cards and preserves accumulated `Load more venues`.
- Rows/cards are not clickable navigation targets.
- Visible venue names are links only when the selected team scope has a
  `team_venues.id` target for that organization venue.
- `Team Context` shows team badges for every team that uses the visible venue.
- The disabled overflow column has been removed.
- The desktop table no longer repeats the scoped Organization column.
- The desktop Location column is intentionally narrow so Team Context badges
  have more room.
- The desktop table is wrapped in the current `GradientCard` table surface.
- Desktop create remains in the toolbar and opens a right-side Sheet, matching
  the desktop create surface requested for this route.
- Mobile create uses `mobile-floating-action size-14` and opens a bottom
  Drawer backed by the shared `VenueDialogForm` internals, with fixed
  header/footer and one scrollable body.
- Create and update actions validate inputs and organization-operation
  capability on the server.
- Update hardening is stronger than the list UI: `updateVenueAction()` requires
  scoped `teamVenueId`, active team scope, venue ownership, and team-venue
  ownership before writing.
- Focused Node tests now cover Venue list request normalization, desktop
  pagination, mobile load-more hrefs, and `venueStatus` href preservation.

### Target state

The first data/loading target and list UI parity target are implemented. The
remaining target is operational hardening:

- Keep server-first auth, organization-route access, billing/quota feedback,
  and permission checks.
- Keep stable list chrome separate from result rows.
- Keep page-bounded venue results.
- Render mobile as cards with accumulated `Load more venues`.
- Move mobile create to a single `mobile-floating-action size-14` FAB that
  opens a bottom Drawer.
- Keep desktop create in the toolbar.
- Avoid row/card click navigation; keep navigation limited to explicit links.
- Show Team Context as badges for the teams that use each venue.
- Keep desktop as table-only without dead row action chrome.
- Add timing logs for large-organization triage.
- Add a local results retry surface.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.0/5 | The route resolves auth/org scope first, splits chrome from results, count-bounds rows with `VENUES_PAGE_SIZE = 25`, clamps invalid pages, supports mobile accumulation, and limits team-context hydration to visible venues. Remaining gaps are lack of timing logs and no local results retry boundary. |
| UI consistency | 4.2/5 | Desktop has mounted chrome, status filtering, toolbar create, `GradientCard` table, numbered pagination, transition spinner, team context badges, and no dead overflow column. Mobile now has cards, accumulated `Load more`, team context badges, and FAB plus Drawer create. |
| Code tidiness | 4.0/5 | Route state, tests, chrome data, results data, route shell, skeleton pieces, split result surfaces, feedback, actions, and form surfaces are now separate. Remaining issue is the compatibility `getVenuePageData()` loader. |
| Scalability | 3.8/5 | Results are page-bounded, count-backed, and team context hydration is limited to visible rows. Status counts still use exact count queries and there are no timing logs to validate cost on large organizations. |
| Best practices | 4.2/5 | Server-side auth, organization-route gating, Sonner feedback, Zod-backed create input, billing entitlement, hardened update rules, route-state tests, split `Suspense`, pagination feedback, mobile cards, and Drawer/FAB create are in place. Missing piece is route-level results retry. |
| Modularity | 4.0/5 | The route now has the newer `list-route-state.mjs`, `VenuesRouteShell`, `getVenuesChromeData()`, `getVenuesResultsData()`, `VenuesChromeSkeleton`, and `VenuesResultsSkeleton` shape used by newer list routes. |
| Security | 4.1/5 | Read access is behind organization-route access and RLS. Creates check organization-operation capability and billing entitlement. Updates validate active team, team venue, venue ownership, and organization ownership before writing. The main gap is that org-level create still depends on the submitted organization id instead of deriving the write target entirely from active scope. |

Overall: 4.1/5. `/venues` now has the core data/loading architecture and the
current mobile/desktop list shape expected for Sailog operational routes. The
remaining work is mostly measurement, retry behavior, and create-scope
hardening.

## Current Architecture

Entry points:

- `app/(app)/venues/page.tsx`
- `app/(app)/venues/loading.tsx`
- `components/shared/page-skeletons.tsx`
- `features/venues/list-route-state.mjs`
- `features/venues/list-route-state.test.mjs`
- `features/venues/data.ts`
- `features/venues/venues-route-shell.tsx`
- `features/venues/venues-table.tsx`
- `features/venues/venue-form-dialogs.tsx`
- `features/venues/actions.ts`
- `features/venues/update-action-core.mjs`
- `features/venues/action-rules.mjs`
- `features/venues/action-rules.test.mjs`
- `features/venues/venues-feedback.tsx`
- `features/venues/navigation.ts`
- `lib/auth/organization-route-guard.ts`
- `lib/auth/capabilities.ts`
- `lib/billing/entitlements.ts`
- `lib/validation/venues.ts`

Data behavior:

- The page resolves authenticated access and organization route access before
  data loading.
- `resolveVenuesListRequest()` normalizes `venueStatus`, `page`, and
  `loadMore`.
- `venueStatus` defaults to `all`; invalid values also become `all`.
- Chrome data loads status counts for `all`, `active`, and `inactive`.
- Results data loads a filtered exact count, clamps `currentPage`, and fetches
  only the visible venue range.
- Desktop pagination uses page numbers through `page=N`.
- Mobile accumulation uses `loadMore=1` and fetches rows from page `1..N`.
- Active-team `team_venues` lookup is limited to visible venue ids.
- The route does not emit timing logs yet.

UI behavior:

- `VenuesFeedback` emits transient action results through Sonner and removes
  consumed `status`/`error` params.
- Read-only users see an inline `Venue management unavailable` warning above
  the list shell.
- `VenuesRouteShell` owns `Organization Venues`, the `venueStatus` select, the
  desktop create action, the mobile create FAB/Drawer, and the filter
  transition overlay.
- `VenuesTable` renders the bounded venue rows.
- Desktop pagination disables and dims the table while a page navigation is
  pending.
- Mobile `Load more venues` preserves previous accumulated rows and shows
  pending state in the button.
- Mobile renders venue cards; desktop renders a table only.
- Rows/cards do not navigate on click or keyboard Enter/Space.
- The visible venue name links to `/venues/[teamVenueId]?tab=camps` only when
  the selected team scope uses that venue.
- Unlinked selected-team venues render the venue name as plain text.
- Team Context renders badges for every team using the venue, with the selected
  scoped team badge visually distinguished when present.
- The desktop table omits the scoped Organization column and the dead overflow
  action column.

Mutation behavior:

- `createVenueAction()` validates form input, organization-operation
  capability, billing entitlement, and inserts an active venue.
- `updateVenueAction()` delegates to `runUpdateVenueAction()`, which validates
  submitted scope, active team, team venue, venue ownership, and organization
  ownership before updating.
- Mutations revalidate `/venues`; update also revalidates the redirect target
  path.
- Redirects preserve org/team scope and selected Venue detail route state when
  a safe `redirectTo` is provided.

## Standards Comparison

### Loading Patterns

Matches:

- The route has `app/(app)/venues/loading.tsx`.
- Auth, route access, feedback, quota, and scope warnings resolve before the
  list renders.
- Chrome and results data are split.
- Result rows load behind nested `Suspense`.
- Route-level skeleton is composed from chrome and results pieces.
- Save/create pending state remains inside submitted buttons.
- Page/filter transitions keep the table mounted and show one local spinner.
- Mobile load-more keeps current rows mounted and shows pending state in the
  button.

Gaps:

- No local results retry surface yet.
- No timing logs for performance triage.

### Mobile UI

Matches:

- Create form fields use the shared form internals and pending submit state.
- Mobile has an accumulated `Load more venues` button with pending feedback.
- Mobile renders `GradientCard` rows.
- Mobile create uses a `mobile-floating-action size-14` FAB.
- Mobile create opens a bottom Drawer with fixed header/footer and one
  scrollable body.
- Team context is visible as badges in each card.

Gaps:

- The selected-team venue name link still has no local pending state.

### Desktop UI

Matches:

- Desktop uses a table.
- Empty state lives inside the table body.
- Visible venue labels are real links when the selected team scope has a Team
  Venue detail target.
- Rows are not clickable navigation targets.
- Read-only warning lives above the table.
- Desktop now has numbered pagination.
- Desktop page transitions dim the table and show one centered spinner.
- Desktop uses the `GradientCard` table surface.
- Desktop omits the repeated Organization column.
- Desktop omits the dead overflow column.
- Desktop keeps `New` in the toolbar as a right-Sheet-backed create action.
- Desktop narrows the Location column to preserve room for Team Context badges.
- Team Context renders team badges.

Gaps:

- A real row actions menu can be added later if venue row actions ship.

## Current Risks

1. Status counts use exact count queries without timing logs; this should be
   measured on larger organizations.
2. Results failures still fall through route error handling rather than a local
   retry surface.
3. Venue create derives the target organization from form data. Permission
   checks protect the write, but the cleaner org-route pattern is to derive the
   organization from active scope and avoid a writable organization selector
   when the route is already scoped.

## Validation Snapshot

Latest validation after Steps 1 through 5:

- `npm test` passed.
- `./node_modules/.bin/tsc --noEmit --pretty false` passed.
- `npm run lint -- features/venues/venues-table.tsx features/venues/venue-form-dialogs.tsx features/venues/venues-route-shell.tsx components/shared/page-skeletons.tsx` passed.
- `git diff --check -- 'app/(app)/venues/page.tsx' features/venues/data.ts features/venues/list-route-state.mjs features/venues/list-route-state.test.mjs features/venues/venue-form-dialogs.tsx features/venues/venues-route-shell.tsx features/venues/venues-table.tsx components/shared/page-skeletons.tsx package.json AUDIT_VENUES.MD` passed.

## Next Engineering Priority

Step 6: Operational hardening.

- Add timing logs for chrome counts and result queries.
- Add a local retry surface for result-loading failures.
- Derive create organization from active route scope instead of trusting a
  writable organization field on the scoped route.
- Decide whether org-level Venue rows need real row actions; keep the action
  column absent until they do.
