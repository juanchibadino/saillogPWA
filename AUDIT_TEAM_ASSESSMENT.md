# Team Assessments List Audit

Date: 2026-07-07

Scope: current `/team-assessments` list implementation. This audit covers the
list route, tabs, create-run surface, template list/editor entry point, loading
state, pagination behavior, server data path, and mutation boundaries. The
detail route `/team-assessments/[id]` should stay as a separate audit surface.

## Snapshot Register

### Foto actual

- The route requires authenticated access, resolves the active org/team scope,
  and renders explicit no-scope, no-team, and read-only states before the main
  client surface.
- The list has two tabs: `Created` for assessment runs and `Templates` for
  template management.
- The visible `Assessments` page title was removed from the list chrome.
- Mobile tabs now span the full available width as two equal columns, while
  desktop keeps the compact tabs control.
- Mobile run rows render as tappable cards with local navigation spinners,
  prefetch on intent, action menus, and a full-width `Load more assessments`
  button.
- Desktop run rows render as a table with pagination, row navigation, action
  menus, and a table-level loading overlay during page transitions.
- Create assessment uses mobile Drawer and desktop Sheet, with fixed footer
  submit controls and pending/disabled feedback.
- Template management uses mobile cards, desktop table, and an inline editor
  panel for new or selected templates.
- Initial route loading has a dedicated `app/(app)/team-assessments/loading.tsx`
  skeleton with title-free chrome, full-width mobile tabs, mobile cards, and
  desktop table placeholders.
- `supabase/migrations/031_assessments_team_route_indexes.sql` adds indexes for
  team-scoped assessment runs and templates.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 3.8/5 | Runs are paged and mobile can accumulate pages, with indexes for team/date reads. The route still loads venue/camp context, templates, an exact count, and run details together before first render. There is no timing instrumentation yet. |
| UI consistency | 4.2/5 | The route follows the desktop table plus mobile cards pattern, has full-width mobile tabs, mobile Drawer/desktop Sheet creation, action menus, and visible pending states. The remaining gap is template editor density and lack of a stronger mobile editing surface. |
| Code tidiness | 4.0/5 | Page, client shell, data loader, navigation helpers, route state, actions, definition utilities, and editor are separated. The client file is still large and mixes run list, create dialog, template list, and template editor wiring. |
| Scalability | 3.7/5 | The route has basic pagination and route indexes. Scaling pressure remains around exact counts, full template loading, team venue/camp context loading, and multi-query run hydration. |
| Best practices | 4.1/5 | Auth and writes are server-first, inputs are Zod validated, scope is preserved in links/forms, and RLS remains the database backstop. The route needs focused tests for action redirects/status messages and browser-level form behavior. |
| Modularity | 3.8/5 | Domain helpers are split, but the main client surface still owns several sub-surfaces that will get harder to maintain as assessment workflows grow. |
| Security | 4.4/5 | Mutations check authenticated access, active scope, role capability, and ownership before writing. The main residual risk is coverage: forbidden and cross-scope cases need focused regression tests. |

Overall: 4.0/5. The `/team-assessments` list is usable and aligned with the
current Sailog route patterns, but it is still an early operational surface.
The next gains should come from status-message correctness, timing visibility,
and splitting the large client file once behavior stabilizes.

## Current Architecture

Entry points:

- `app/(app)/team-assessments/page.tsx`
- `app/(app)/team-assessments/loading.tsx`
- `features/assessments/team-assessments-page-client.tsx`
- `features/assessments/template-editor.tsx`
- `features/assessments/data.ts`
- `features/assessments/actions.ts`
- `features/assessments/navigation.ts`
- `features/assessments/list-route-state.mjs`
- `features/assessments/list-route-state.d.mts`
- `features/assessments/list-route-state.test.mjs`
- `supabase/migrations/031_assessments_team_route_indexes.sql`

Data behavior:

- `TeamAssessmentsPage` resolves authenticated access and navigation scope.
- `resolveTeamAssessmentsListRequest()` normalizes tab, page, mobile
  `loadMore`, selected template, and new-template state.
- `getTeamAssessmentsPageData()` loads team venue/camp context, active
  templates, exact run count, visible run rows, and hydrated run detail data.
- Created runs are ordered by `created_at desc`.
- Desktop pagination replaces the current page.
- Mobile `Load more` uses `loadMore=1` and accumulates pages from `1..N`.

UI behavior:

- The route-level title is no longer rendered inside the assessment surface.
- Mobile tabs are full width; desktop tabs remain compact.
- Created tab shows mobile cards and desktop table.
- Templates tab shows mobile cards, desktop table, and the editor when a
  template is selected or `new=template` is present.
- Run cards and table rows prefetch detail routes and show local spinners while
  navigation is pending.
- Create assessment opens as mobile Drawer or desktop Sheet.
- Create, close, delete, page navigation, run navigation, and mobile load-more
  paths show visible pending feedback.

Mutation behavior:

- `saveAssessmentTemplateAction()` validates scope, capability, template
  ownership, and definition data before replacing template structure.
- `createAssessmentRunAction()` validates scope, capability, team venue,
  template ownership, camp IDs, and run definition before creating a published
  run and crew respondents.
- `closeAssessmentRunAction()` validates scope, capability, and run ownership
  before closing.
- `deleteAssessmentRunAction()` validates scope, capability, and run ownership
  before deleting.
- `submitAssessmentAnswersAction()` belongs to the detail route but revalidates
  the same assessment paths after answer saves.

## Current Risks

1. Status codes are inconsistent between some server-action redirects and page
   message readers. For example, actions emit statuses such as `template_saved`,
   `run_published`, `run_closed`, and `run_deleted`, while the list/detail pages
   currently look for older names such as `created`, `closed`, and `deleted`.
2. There is no timing log for the assessment list route, so slow phases cannot
   be separated between scope/context, templates, count, runs, and hydration.
3. The initial list render waits for both templates and created runs even though
   only one tab is visible at a time.
4. The main client file is large and mixes multiple operational surfaces.
5. Template editing is functional, but mobile editing is still dense compared
   with the newer fixed-header/fixed-footer detail patterns.
6. Automated coverage appears narrow; route-state helpers exist, but action
   redirects, forbidden paths, and browser form flows still need focused tests.

## Validation Snapshot

Validation for this audit/update:

- `git diff --check` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run lint` exited 0 with two unrelated existing warnings:
  `app/sign-in/sign-in-content.tsx` unused `isRegisterMode`, and
  `features/onboarding/onboarding-flow.tsx` unused `Label`.
- `npm test` passed with 56 tests.

## Next Engineering Priority

1. Align assessment action status codes with the list/detail page message
   readers so save/create/close/delete/answer feedback appears reliably.
2. Add `team_assessments_list_timing` logs around scope/context, templates,
   count, runs, and hydration.
3. Split list data loading by visible tab so `Created` does not wait on full
   template editing data unless needed, and `Templates` does not wait on run
   hydration unless needed.
4. Extract run list, create dialog, template list, and template editor shell
   from `features/assessments/team-assessments-page-client.tsx`.
5. Add focused tests for `list-route-state`, status redirect mapping,
   permission failures, and mobile load-more behavior.
