# Secondary Route Loading Audit

Date: 2026-07-10

Scope: contrast the current low-traffic team/ops pages against the mature
Venue, Camps, and Sessions loading patterns.

Routes audited:

- `/team-standard-moves`
- `/team-wind-patterns`
- `/team-notes`
- `/team-assessments`
- `/team-assets`
- `/team-gear`
- `/team-reports`
- `/reports`

Pattern documents reviewed:

- `LOADING_PATTERNS.md`
- `MOBILE_UI_PATTERNS.md`
- `DESKTOP_UI_PATTERNS.md`
- `AUDIT_TEAM_VENUE.MD`
- `AUDIT_TEAM_CAMP.MD`
- `AUDIT_TEAM_SESSION.MD`
- `AUDIT_TEAM_ASSESSMENT.md`
- `AUDIT_TEAM_STANDARD_MOVES.md`
- `AUDIT_REPORTS.md`

## Baseline To Match

The mature Venue, Camps, and Sessions surfaces share the same user-facing rule:
the page should feel anchored before slower data arrives.

The baseline is:

- Route auth/scope checks run first.
- Stable page chrome appears early: title, filters, tabs, primary action, and
  persistent warnings.
- Expensive rows/cards/tabs load behind `Suspense` or a scoped tab request.
- Route-level `loading.tsx` mirrors the final layout for cold entry.
- Nested fallback skeletons mirror only the deferred result area.
- Desktop uses tables for row/list routes; media routes use stable grouped
  grids.
- Mobile uses cards or compact media grids.
- Filter/page/load-more transitions keep current rows/cards mounted, dimmed,
  and overlaid or use button-level pending state.
- Generic full-panel spinners are avoided when the final table/card shape is
  already known.

## Current Route Scores

| Route | Score | Current state | Main gap |
| --- | ---: | --- | --- |
| `/team-standard-moves` | 4.5/5 | Matches the list shell + results pattern with route skeleton, nested results skeleton, mobile cards, desktop table, FAB, Drawer/Sheet forms, transition overlay, load-more pending, and retry. | Mostly polish: title copy is `Standard Moves` while the sidebar uses `Std. Moves`; timing logs and grouped usage counts are optional future work. |
| `/team-wind-patterns` | 4.2/5 | Correctly clones the Standard Moves route shape: stable title/filter/create chrome, route skeleton, nested results skeleton, desktop table, mobile cards, and mobile FAB. | Results failure is a static error panel with no local retry; no timing logs; usage counts still fan out per visible pattern. |
| `/team-reports` and `/reports` | 4.3/5 | Already normalized: split chrome/results, route skeletons, nested result skeletons, desktop tables, mobile cards, team create FAB/Drawer, organization filter Drawer, desktop pagination, and mobile load more. | Add local nested-results retry and timing logs. Team Reports also waits for create options before the real shell mounts, though the route skeleton keeps the title visible. |
| `/team-assessments` | 4.1/5 | Strong in-panel behavior: immediate tab switching, Created/Templates skeletons, mobile cards, desktop tables, load-more pending, row navigation spinners, and timing logs. | Initial route entry still loads selected-tab data before the client surface; route loading has tabs but no page title. Existing audit says the title was intentionally removed, so title parity needs a product decision. |
| `/team-assets` | 3.9/5 | Uses route-level chrome/results skeletons, top Images/Files tabs, grouped venue/session asset grids, mobile filter Drawer, desktop filters, transition overlays, and button-level load-more pending. | Initial route entry waits for full `getTeamAssetsPageData()` before the client shell mounts; tabs intentionally replace the title, so title parity needs a product decision. No nested `Suspense` or local results retry yet. |
| `/team-notes` | 3.0/5 | Has a route-level skeleton and the skeleton roughly mirrors the rich note card shape. | No stable title, no shell/results split, no nested results fallback, no secondary transition overlay, load more is a plain link, and the data loader builds/filters all session note cards before slicing. |
| `/team-gear` | 2.7/5 | Has a route-level skeleton and page-bounded display after all calculations. | Biggest mismatch: no stable title before data, no shell/results split, no mobile cards, live route is table-first on mobile, no secondary pending overlay, no route-state helper, and the loader calculates usage/alerts across all matching gear before slicing. |

## Route Details

### `/team-standard-moves`

Current implementation:

- `app/(app)/team-standard-moves/page.tsx` resolves auth/scope first.
- `getTeamStandardMovesChromeData()` loads status counts.
- `getTeamStandardMovesResultsData()` loads bounded rows.
- `TeamStandardMovesRouteShell` owns stable title, filter, desktop `New`,
  mobile FAB, and transition overlay.
- `TeamStandardMovesResultsSkeleton` mirrors mobile cards and desktop table.
- `StandardMovesResultsRetry` gives local retry behavior.

What I would change:

- Do not rebuild the loading architecture.
- Decide whether the visible route title should stay `Standard Moves` or match
  the sidebar shorthand `Std. Moves`; then update live title and skeleton
  together if it changes.
- Add timing logs only if this page starts appearing in slow route reports.
- Consider grouped usage counts/RPC later if visible-row exact count fanout
  becomes measurable.

### `/team-wind-patterns`

Current implementation:

- `app/(app)/team-wind-patterns/page.tsx` follows the same shell/results split
  as Standard Moves.
- `TeamWindPatternsRouteShell` keeps `Wind Patterns`, status filter, desktop
  `New`, and mobile FAB stable.
- `TeamWindPatternsResultsSkeleton` mirrors mobile cards and desktop table.

What I would change:

- Add a `TeamWindPatternsResultsRetry` component matching
  `StandardMovesResultsRetry` instead of returning a static rose error panel.
- Add timing logs for venue-option chrome, count, rows, and usage counts if this
  route gets more data.
- Leave the UI shape alone; it is already the right pattern.

### `/team-reports` and `/reports`

Current implementation:

- Both routes use the current list shell + results pattern.
- `TeamReportsRouteShell` renders title and create action for team reports.
- `OrganizationReportsRouteShell` renders title and filter chrome for org
  reports.
- `ReportsTable` renders mobile cards, desktop table, mobile load more, and
  desktop pagination overlay.
- Route-level skeletons mirror the card/table split.

What I would change:

- Add a local results retry state around nested `getTeamReportsResultsData()`
  and `getOrganizationReportsResultsData()` failures.
- Add timing logs before optimizing further.
- If team report creation options become slow, lazily hydrate create camp
  options when opening the create surface so the real title/header can mount
  even earlier.

### `/team-assessments`

Current implementation:

- The list route has no visible `Assessments` page title by current design.
- `app/(app)/team-assessments/loading.tsx` shows tabs and Created-tab skeleton.
- `TeamAssessmentsPageClient` handles immediate tab switching and uses
  `TeamAssessmentsCreatedTabSkeleton`,
  `TeamAssessmentsTemplatesTabSkeleton`, and
  `TeamAssessmentTemplateEditorSkeleton`.
- Created renders mobile cards and desktop table.
- Templates renders mobile cards and desktop table/editor.

What I would change:

- If the new standard is "every low-traffic page still needs a ready title",
  reintroduce a compact `Assessments` title in both the live shell and
  `loading.tsx`. This intentionally supersedes the older audit note that the
  title was removed.
- Split initial route entry into stable tab/action chrome plus selected-tab
  data behind a server `Suspense` boundary, using the existing tab skeletons as
  the fallback.
- Keep the immediate client tab-switch behavior; it is already correct.
- Do not redesign the assessment tabs or template editor as part of the loading
  pass.

### `/team-assets`

Current implementation:

- `app/(app)/team-assets/page.tsx` resolves auth/scope first, then waits for
  `getTeamAssetsPageData()` before rendering `TeamAssetsPageClient`.
- `app/(app)/team-assets/loading.tsx` renders `TeamAssetsPageSkeleton`.
- `TeamAssetsPageSkeleton` is already composed from
  `TeamAssetsChromeSkeleton` and `TeamAssetsResultsSkeleton`.
- The chrome skeleton mirrors the live top bar: Images/Files tabs, mobile
  filter button, and desktop Venue/Year/Camp/Session filters.
- The results skeleton mirrors the grouped venue/session grid and asset-card
  layout.
- The client keeps current grouped assets mounted and dimmed during tab/filter
  route transitions.
- Mobile load-more is a client fetch against `app/api/team-assets/list/route.ts`
  with button-level pending state.
- Session dates and camp names inside grouped headings link to the existing
  Session and Camp detail routes.

What I would change:

- Do not force a desktop table; Assets is a media browse surface and the
  grouped grid is the right final shape.
- Decide whether the current top-bar tabs intentionally replace an `Assets`
  title. This was previously requested, but it conflicts with the newer
  "title ready" wording if interpreted literally.
- Split initial route entry into:
  - `getTeamAssetsChromeData()` for filter options, selected filters, selected
    tab, and capability.
  - `getTeamAssetsResultsData()` for bounded assets, signed URLs, pagination,
    and grouped results.
- Wrap only the results grid in a nested `Suspense` fallback using the existing
  `TeamAssetsResultsSkeleton`.
- Add a local retry state for failed initial/deferred results.
- Keep client load-more; it already gives the right accumulated browsing feel.
- If image signing becomes slow again, keep the current thumbnail/display
  signed-url batching and avoid signing file downloads until click.

### `/team-notes`

Current implementation:

- `app/(app)/team-notes/page.tsx` waits for `getTeamNotesPageData()` before
  rendering toolbar and cards.
- `TeamNotesPageSkeleton` starts with toolbar placeholders and note-card
  skeletons.
- `TeamNotesToolbar` pushes filter/search route changes, but there is no local
  transition overlay.
- `TeamNotesCards` renders rich note cards and a plain `Load more sessions`
  link.
- The data loader builds all matching session note cards in memory and then
  slices the visible page.

What I would change:

- Add a `TeamNotesRouteShell` with a stable `Notes` or `Team Notes` title,
  search/filter chrome, and transition overlay.
- Split data into:
  - `getTeamNotesChromeData()` for filter options and normalized selections.
  - `getTeamNotesResultsData()` for visible card rows and `hasNextPage`.
- Add `TeamNotesChromeSkeleton`, `TeamNotesResultsSkeleton`, and compose
  `TeamNotesPageSkeleton` from both.
- Convert `Load more sessions` to a button-driven pending state like Reports,
  Assessments, Camps, and Sessions.
- Add a local retry surface for deferred results.
- Rework the loader so page/windowing happens before full note-card hydration.
  The current all-sessions build is acceptable only while data is small.

### `/team-gear`

Current implementation:

- `app/(app)/team-gear/page.tsx` waits for `getTeamGearPageData()` before
  rendering toolbar/table.
- `TeamGearPageSkeleton` is a generic filter/table skeleton and does not show a
  stable title first.
- `TeamGearTable` renders a desktop table surface; it does not switch to mobile
  cards.
- Filters navigate directly with no local transition overlay.
- `getTeamGearPageData()` loads all matching gear, alert rules, usage links,
  and session durations before slicing visible rows.

What I would change first:

- Add `TeamGearRouteShell` with stable `Gear` title, filters, desktop `New`,
  and mobile FAB.
- Split data into chrome and results:
  - chrome: normalized filters and option lists.
  - results: bounded visible gear rows, pagination, usage, alerts.
- Add `TeamGearChromeSkeleton`, `TeamGearResultsSkeleton`, and update
  `TeamGearPageSkeleton` to mirror title + filters + mobile cards + desktop
  table.
- Add mobile cards for gear rows. This is required for parity with Venue,
  Camps, Sessions, Std. Moves, Wind Patterns, Assessments, and Reports.
- Add a route-state helper/test for filters, page, and mobile `loadMore`.
- Change the loader to page gear rows before hydrating usage/alert state for
  visible ids. If alert filtering must apply after rule evaluation, add a
  bounded database/RPC path rather than calculating every row in the page.
- Add secondary loading overlays for filter/page transitions and button-level
  pending for mobile load more.

## What I Would Change In Order

1. **Gear parity pass.** It is the only audited route that still violates the
   mobile card vs desktop table rule and the stable title/chrome rule.
2. **Notes shell/results pass.** Keep the rich card design, but add ready title,
   split loading, transition overlay, pending load more, and a bounded loader.
3. **Assessment title decision.** If the current request overrides the older
   no-title decision, add a compact `Assessments` title to live and loading
   states together. Then split initial selected-tab data behind `Suspense`.
4. **Assets initial split.** Keep the grouped media grid, but split tabs/filter
   chrome from asset results and decide whether tabs continue to replace the
   visible title.
5. **Wind Patterns retry.** Keep the cloned Std. Moves architecture; just add
   local results retry and optional timing.
6. **Reports retry/timing.** Architecture is already correct; add hardening.
7. **Std. Moves copy/timing.** No loading rebuild needed.

## Documentation Follow-up

`LOADING_PATTERNS.md` currently names several mature references, but it does
not yet list `/team-wind-patterns`, `/team-assets`, `/team-notes`,
`/team-gear`, or the `/team-assessments` list as full-current references.

After the code changes above, update `LOADING_PATTERNS.md` with a short
"Secondary Team Routes" section:

- Std. Moves and Wind Patterns inherit the list shell + results pattern.
- Reports already follows the same pattern.
- Assets should be documented as a media-grid variant once its initial
  chrome/results split is implemented.
- Notes and Gear should not be called pattern-complete until their shell/results
  split and mobile card skeletons are implemented.
- Assessments should be documented separately as tab-first loading, with the
  title decision recorded explicitly.
