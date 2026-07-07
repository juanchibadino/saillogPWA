# Team Assessments List Audit

Date: 2026-07-07

Scope: current `/team-assessments` list implementation. This audit covers the
list route, Created/Templates tabs, create-run surface, template list/editor
entry point, loading and pending behavior, pagination, server data path,
mutation boundaries, timing logs, and tests. The detail route
`/team-assessments/[id]` stays as a separate audit surface.

## Snapshot Register

### Foto actual

- The route requires authenticated access, resolves active org/team scope, and
  renders explicit no-scope, no-team, and read-only states before the main
  client surface.
- The list has two route-backed tabs: `Created` for assessment runs and
  `Templates` for template management.
- The visible `Assessments` page title was removed from the list chrome.
- Mobile tabs span the full available width as two equal columns, while desktop
  keeps the compact tabs control.
- Tab clicks now follow the Team Venue ID / Team Session ID standard: the tab
  trigger updates immediately through local client state, then route navigation
  loads the selected tab payload behind a matched panel skeleton.
- Initial route loading uses `app/(app)/team-assessments/loading.tsx`, which now
  reuses the same Created-tab skeleton as the in-route pending tab state.
- `Created` data loading is split from template editing data. It loads venue
  and camp context, lightweight template options, run count, visible run rows,
  and run hydration only.
- `Templates` data loading is split from run data. It loads full template
  definitions only when the Templates tab is visible.
- Mobile run rows render as tappable cards with local navigation spinners,
  prefetch on intent, action menus, and full-width `Load more assessments`.
- Desktop run rows render as a table with pagination, row navigation, action
  menus, and a table-level loading overlay during page transitions.
- Create assessment uses mobile Drawer and desktop Sheet, fixed footer submit
  controls, and pending/disabled feedback.
- Create run no longer sends hidden template definition JSON from the client.
  The server action loads and validates the selected template definition at
  submit time.
- Template management uses mobile cards, desktop table, and a separated editor
  shell for new or selected templates.
- Feedback status codes are aligned between actions and page message readers:
  `template_saved`, `run_published`, `run_closed`, `run_deleted`, and
  `answers_saved`.
- `team_assessments_list_timing` logs cover `scope/context`, `templates`,
  `count`, `runs`, and `hydration` phases with metadata for the active tab path.
- Focused tests cover route-state normalization, status redirect mapping,
  permission failures, legacy status aliases, and mobile load-more behavior.
- `supabase/migrations/031_assessments_team_route_indexes.sql` adds indexes for
  team-scoped assessment runs and templates.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Performance, RES-style proxy | 4.4/5 | The route now loads only the visible tab payload, uses lightweight template options for Created, logs timing phases, and keeps immediate tab feedback with matched skeletons. Remaining cost is exact run counts plus multi-query run hydration. |
| UI consistency | 4.6/5 | The route follows Sailog desktop table plus mobile cards, full-width mobile tabs, mobile Drawer/desktop Sheet, route-entry skeletons, immediate tab-switch skeletons, action pending states, and load-more behavior. The remaining UI gap is the density of template editing on mobile. |
| Code tidiness | 4.5/5 | The large client surface was split into run list, create dialog, template list, template editor shell, skeleton, formatting, and scope-field modules. The action file is still broad because template/run/answer mutations share one module. |
| Scalability | 4.2/5 | Pagination, route indexes, tab-specific loading, server-side template-definition loading, and timing logs reduce growth pressure. Exact counts and run hydration can still become the next bottleneck at larger team volumes. |
| Best practices | 4.5/5 | Auth and writes are server-first, inputs are Zod validated, scope is preserved, RLS remains the database backstop, status feedback is centralized, and list-route helpers have focused tests. |
| Modularity | 4.5/5 | The page client now coordinates tabs and actions only; feature surfaces are extracted into focused modules. Further gains would come from splitting `features/assessments/actions.ts` by list/detail/template responsibilities. |
| Security | 4.5/5 | Mutations check authenticated access, active scope, role capability, ownership, and published/respondent state where relevant. The new action-rule tests cover allowed and forbidden management roles. |

Overall: 4.5/5. The `/team-assessments` list is now aligned with the current
Sailog list/detail loading standards for visible-tab loading, immediate tab
feedback, mobile cards, desktop tables, route-state helpers, and server-first
mutation behavior. The remaining work is no longer broad reconstruction; it is
targeted hardening around query cost, template editing ergonomics, and action
module boundaries.

## Current Architecture

Entry points:

- `app/(app)/team-assessments/page.tsx`
- `app/(app)/team-assessments/loading.tsx`
- `features/assessments/team-assessments-page-client.tsx`
- `features/assessments/team-assessment-runs-list.tsx`
- `features/assessments/team-assessment-run-create-dialog.tsx`
- `features/assessments/team-assessment-template-list.tsx`
- `features/assessments/team-assessment-template-editor-shell.tsx`
- `features/assessments/team-assessments-tab-skeletons.tsx`
- `features/assessments/template-editor.tsx`
- `features/assessments/data.ts`
- `features/assessments/actions.ts`
- `features/assessments/action-rules.mjs`
- `features/assessments/navigation.ts`
- `features/assessments/list-route-state.mjs`
- `features/assessments/list-route-state.d.mts`
- `features/assessments/list-route-state.test.mjs`
- `features/assessments/action-rules.test.mjs`
- `features/assessments/list-timing.ts`
- `supabase/migrations/031_assessments_team_route_indexes.sql`

Data behavior:

- `TeamAssessmentsPage` resolves authenticated access and navigation scope.
- `resolveTeamAssessmentsListRequest()` normalizes tab, page, mobile
  `loadMore`, selected template, and new-template state.
- `getTeamAssessmentsCreatedTabData()` loads only the Created-tab payload:
  context options, lightweight template options, exact count, runs, and run
  hydration.
- `getTeamAssessmentsTemplatesTabData()` loads only the Templates-tab payload:
  full template definitions and editor structure.
- `getTeamAssessmentsPageData()` remains as a compatibility wrapper but the
  route now calls the selected-tab loader directly.
- Created runs are ordered by `created_at desc`.
- Desktop pagination replaces the current page.
- Mobile `Load more` uses `loadMore=1` only for Created and accumulates pages
  from `1..N`.

UI behavior:

- The route-level title is no longer rendered inside the assessment surface.
- Mobile tabs are full width; desktop tabs remain compact.
- Tab clicks update local tab state immediately and show a Created/Templates
  skeleton while the route-backed payload loads.
- Created tab shows mobile cards and desktop table.
- Templates tab shows mobile cards, desktop table, and the editor when a
  template is selected or `new=template` is present.
- Run cards and table rows prefetch detail routes and show local spinners while
  navigation is pending.
- Create assessment opens as mobile Drawer or desktop Sheet.
- Create, close, delete, page navigation, run navigation, mobile load-more, and
  tab navigation paths show visible pending feedback.

Mutation behavior:

- `saveAssessmentTemplateAction()` validates scope, capability, template
  ownership, and definition data before replacing template structure.
- `createAssessmentRunAction()` validates scope, capability, team venue,
  template ownership, camp IDs, and then loads the full template definition
  server-side before creating a published run and crew respondents.
- `closeAssessmentRunAction()` validates scope, capability, and run ownership
  before closing.
- `deleteAssessmentRunAction()` validates scope, capability, and run ownership
  before deleting.
- `submitAssessmentAnswersAction()` belongs to the detail route but revalidates
  the same assessment paths after answer saves.
- `canManageAssessmentsFromAccess()` now provides a focused pure permission
  rule for assessment management tests and server actions.

## Current Risks

1. Created still pays exact count and hydration cost on each page/load-more
   request. `team_assessments_list_timing` should be used to decide whether
   count approximation, cached counts, or a lighter hydration shape is needed.
2. Template editing is functional but still dense on mobile. It does not yet
   match the strongest fixed-header/fixed-footer edit-surface ergonomics used
   by newer detail forms.
3. `features/assessments/actions.ts` is still a broad mutation module. It now
   has better permission rules and status mapping, but future work should split
   template, run lifecycle, and answer-submit actions if the file continues to
   grow.
4. Route-entry loading still uses an App Router segment skeleton rather than a
   nested list shell/results `Suspense` split. The immediate tab skeleton
   removes the most visible tab delay, but initial route entry still waits for
   the selected tab payload.
5. There is focused unit coverage, but no browser-level authenticated
   verification for the create/close/delete/template flows in this audit pass.

## Validation Snapshot

Validation for this audit/update and the current route state:

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run lint` exited 0 with two unrelated existing warnings:
  `app/sign-in/sign-in-content.tsx` unused `isRegisterMode`, and
  `features/onboarding/onboarding-flow.tsx` unused `Label`.
- `git diff --check` passed.
- `npm test` passed with 64 tests.
- `npm run build` passed.

## Next Engineering Priority

1. Use `team_assessments_list_timing` logs from real usage to identify whether
   exact count, run hydration, or context/options loading is the next
   bottleneck.
2. Improve the template editor mobile ergonomics: fixed header/footer behavior,
   better section density, and clearer save/cancel placement without changing
   the data model.
3. Split `features/assessments/actions.ts` into focused action modules if
   assessment mutations keep growing.
4. Add authenticated browser verification for Created run creation, close,
   delete, template save, and immediate tab-switch loading behavior.
