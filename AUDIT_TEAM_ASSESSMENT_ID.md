# Team Assessment ID Audit

Date: 2026-07-08

Scope: current `/team-assessments/[id]` implementation after the analytics-first
detail pass. This audit covers the assessment detail route, role behavior,
analytics, answer input, loading state, server data path, mutations, risks, and
the explicit UI/UX and Performance implementation steps. The list route remains
covered by `AUDIT_TEAM_ASSESSMENT.md`.

## Snapshot Register

### Foto actual

- The route requires authenticated access, resolves active organization/team
  scope, and renders explicit no-scope, no-profile, no-team, read-only, and
  unavailable states.
- The detail header shows the template/run title, venue/location metadata, and
  a manager-only action menu for delete.
- Role behavior is server-first: `team_admin`, `coach`, and organization admins
  can manage the run; assigned `crew` respondents can answer only published
  runs; non-respondents can read the detail without answer controls.
- Analytics now appear before answer input for every role and use a drill-down
  flow: Category, Mode, and Item selects.
- The selected item renders a chart-area-gradient style chart: one crew-average
  area and thin per-crew respondent lines across comparison runs.
- The answer review area now shows the selected Category/Mode matrix with a
  desktop table and mobile cards. The desktop table uses Indicator plus one
  column per crew respondent.
- Crew answer input now sits below analytics and reuses the same Category/Mode
  filtered interaction while still submitting the complete run answer payload.
- Route loading uses `app/(app)/team-assessments/[id]/loading.tsx`, which
  reuses the shared analytics-first skeleton from `components/shared/page-skeletons.tsx`.
- The detail page resolves auth, scope, feedback params, and manager capability
  first, then loads the current assessment, comparison runs, analytics payload,
  and answer matrix behind a nested `Suspense` boundary.
- The data path loads the current run, comparison runs for the same team and
  template, run structure, respondents, answers, camps, venue context, and
  template names through `features/assessments/data.ts`.
- Detail analytics are now prepared server-side with a focused pure helper that
  matches current-run questions to historical run snapshots and loads respondent
  profile labels only for IDs present in comparison-run answers.
- Mutations remain centralized in `features/assessments/actions.ts`: delete
  and answer submission validate scope and permissions before writes. The
  close action is no longer exposed in the detail UI because assessments stay
  open.

## Scorecard

| Category | Score | Current result |
| --- | ---: | --- |
| Role clarity | 4.5/5 | Permissions remain server-backed and the page now prioritizes analytics before input for managers and crew. |
| Analytics UX | 4.5/5 | Category, Mode, and Item selection now drives a selected-item area chart with crew average and per-crew lines. |
| Answer review UX | 4.4/5 | The selected Category/Mode answer matrix now supports desktop table and mobile card scanning with per-crew answer columns. |
| Crew input UX | 4.4/5 | The form keeps pending-safe saves and now follows the same Category/Mode filter pattern as analytics. |
| Performance | 4.3/5 | Trend data is prepared server-side and the client renders only the selected item chart and selected group matrix. |
| Loading consistency | 4.5/5 | The segment skeleton now mirrors the analytics-first picker, chart, and matrix layout. |

Overall: 4.4/5. The detail route now matches the requested selected-item
analytics flow while preserving the existing server-first permissions and
mutation behavior. Remaining work is mainly authenticated browser verification
with real assessment data and observing detail load cost on larger teams.

## Current Architecture

Entry points:

- `app/(app)/team-assessments/[id]/page.tsx`
- `app/(app)/team-assessments/[id]/loading.tsx`
- `features/assessments/assessment-detail-client.tsx`
- `features/assessments/detail-analytics.mjs`
- `features/assessments/detail-analytics.test.mjs`
- `features/assessments/data.ts`
- `features/assessments/actions.ts`

Data behavior:

- `TeamAssessmentDetailPage` resolves auth, scope, status/error feedback, and
  manager capability before rendering the deferred detail boundary.
- `getTeamAssessmentDetailData()` loads the current run and up to 50 comparison
  runs for the same team/template.
- `loadRunsByIds()` hydrates run scale options, categories, modes, questions,
  camps, respondents, and answers.
- `buildDetailSummaries()` currently derives broad progress points, category
  comparison, and flat question summaries for compatibility.
- `buildTeamAssessmentDetailAnalytics()` derives the selected-item analytics
  dataset used by the client: item metadata, trend points, respondent lines,
  and current crew answers.
- Respondent profile labels are fetched from `profiles` only for respondent IDs
  found in comparison-run answers.

Mutation behavior:

- `deleteAssessmentRunAction()` requires assessment manager capability and run
  ownership in the active team scope.
- `submitAssessmentAnswersAction()` requires a published run, active crew
  membership, and an assigned respondent row before replacing the current
  user's answers.
- Successful mutations revalidate the list, detail, and linked venue paths.

## Current Risks

1. Authenticated browser verification with real assessment data is still needed
   to inspect populated charts, select controls, and answer submission end to
   end.
2. The historical question match uses category/mode/question position plus
   normalized names/prompts. If a template changes labels between runs, some
   historical points can intentionally render as gaps.
3. Per-crew lines can become visually dense for large respondent groups. The
   current implementation honors the requested "all crew" behavior, but a future
   crew filter may be needed.
4. The detail route still loads hydrated comparison runs before rendering. The
   comparison limit controls the worst case, but real usage should determine
   whether a narrower analytics query is needed.

## Implementation Steps

### Step 1: UI/UX Implementation

Status: implemented in this pass.

- Refactor the detail page so analytics appear before answer input for every
  role.
- Add Category, Mode, and Item selects.
- Render a selected-item chart with one crew-average gradient area and thin
  lines for each crew respondent.
- Add a selected Category/Mode read-only answer matrix with desktop table and
  mobile cards.
- Move the crew answer form below analytics and reuse the same Category/Mode
  filtered interaction.

### Step 2: Performance Implementation

Status: implemented in this pass.

- Build selected-item trend data server-side in `features/assessments/data.ts`.
- Load respondent profile labels only for profile IDs present in comparison-run
  answers.
- Keep the existing comparison run limit and team/template filtering.
- Render only the selected item chart and selected Category/Mode matrix on the
  client.
- Update the detail loading skeleton to match the analytics-first layout and
  reuse it for the route-level `loading.tsx` and the nested `Suspense` fallback.

## Validation Snapshot

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run lint` passed with two unrelated existing warnings:
  `app/sign-in/sign-in-content.tsx` unused `isRegisterMode`, and
  `features/onboarding/onboarding-flow.tsx` unused `Label`.
- `npm test` passed with 77 tests.
- `git diff --check` passed.
- `npm run build` passed.
- Browser smoke on the protected detail route passed unauthenticated boundary
  verification: `/team-assessments/00000000-0000-0000-0000-000000000000`
  redirected to `/sign-in`, rendered content, and had no framework error
  overlay.
