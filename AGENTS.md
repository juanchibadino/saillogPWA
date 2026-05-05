# Sailog — Unified Project Spec

It is the single source of truth for:
- product context
- frozen domain rules
- implementation constraints
- development workflow
- execution order

---

## 1. Mission

Build Sailog as a production-ready internal sailing operations app using:

- Next.js App Router for frontend and backend-for-frontend
- Supabase for Auth, Postgres, Storage, and Row Level Security
- shadcn/ui + Tailwind for UI
- TypeScript across the codebase
- PWA support
- Vercel deployment

This app replaces a Glide app already in production being used. 

/deprecated glide tables folder is for context only
/generate report for context only. 


---

## 2. Product context

Sailog is an internal sailing operations app.

Core business model:

- Organizations own Teams
- Teams are made of users with scoped roles such as `team_admin`, `coach`, and `crew`
- Venues are stable places such as Palma, Hyeres, etc.
- A venue must keep the same `venue_id` across years
- Team-venue operations are linked through `team_venues`
- Camps live inside a `team_venue`
- Sessions live inside a `camp`
- Assessments are deferred for now
- Coach session review and crew session setup are separate concerns
- Gear will come later and should not distort the MVP schema now

---

## 3. Frozen domain rules

These rules are locked unless explicitly changed by the product owner.

1. Organizations own Teams
2. Teams are made of users with scoped roles
3. Venues are stable places and keep the same id across years
4. `team_venues` are unique by `(team_id, venue_id)`
5. Camps belong to `team_venues`
6. Sessions belong to camps
7. Assessments are not part of the current core model
8. Coach review and crew setup are separate records
9. Camp totals are derived from session data, not manually edited
10. Gear is phase 2, not MVP core schema

---

## 4. Canonical schema backbone

These are the expected v1 tables.

### Core identity and access
- `profiles`
- `organizations`
- `organization_memberships`
- `teams`
- `team_memberships`

### Operational structure
- `venues`
- `team_venues`
- `camps`
- `sessions`

### Session detail
- `session_reviews`
- `session_regatta_results`
- `session_setups`
- `session_assets`

### Later
- `gear_items`
- `session_gear_usage`


---

## 5. MVP scope

### In scope
- user authentication
- organizations and teams
- role-based access
- venues
- team venues
- camps
- sessions
- coach review data
- crew setup / tuning
- session photos and analytics files
- basic dashboards and operational views
- installable PWA shell

### Out of scope for MVP
- deep offline sync
- advanced analytics warehouse
- highly customized reporting exports
- gear lifecycle management
- notification system
- automation engine
- a generic workflow engine
- assessment workflows

---

## 6. Technical rules

### Architecture
- Use Next.js App Router
- Prefer Server Components by default
- Use Server Actions or Route Handlers only when they clearly fit
- Reuse existing proven vertical patterns before introducing new abstractions (especially the Venues vertical)
- Keep business logic out of UI components
- Keep data access centralized in a small number of server-side modules
- Do not split the backend into a separate service unless there is a proven reason

### TypeScript
- Use explicit types
- Never leave `any`
- Prefer Zod for validating external inputs when validation is needed

### Database
- Supabase is the source of truth
- Manage schema through SQL migrations, not ad hoc dashboard edits
- Keep RLS enabled on all public tables
- Design for relational integrity first
- Use `jsonb` only where the shape is still evolving
- Add indexes intentionally, especially on foreign keys and common filters
- Prioritize fast operational queries for `team_venues`, `camps`, and `sessions`; add composite indexes for hot list/sort paths
- Do not denormalize early
- Use UTC timestamps in the database

### Auth and permissions
- Auth users live in Supabase Auth
- Application profile lives in `public.profiles` linked to `auth.users(id)`
- Access is granted through `organization_memberships` and `team_memberships`
- Do not hardcode permissions in the frontend
- Enforce access with RLS and server-side checks

### UI
- Use shadcn/ui components
- Keep the UI practical and mobile-friendly
- Optimize for internal operational use, not marketing polish
- Avoid dense layouts
- Keep forms straightforward and easy to complete on phones
- Prefer simple tables, cards, and segmented detail screens
- Every new page or major data view must include a matching skeleton loading state using `loading.tsx` (or Suspense fallback when more appropriate)
- If backend latency cannot be reduced further, apply UX masking (fast skeletons, progressive loading states, immediate feedback) to avoid perceived waiting

### PWA
- Make the app installable
- Start with manifest, icons, and mobile shell
- Do not overbuild offline sync in the first MVP unless explicitly requested

---

## 7. Working style

Always work in small, reviewable steps.

Before writing code:
1. explain the functionality in plain language
2. explain why the change is needed
3. propose the smallest possible implementation step

When making changes:
- prefer small diffs over sweeping refactors
- do not rename files or move large structures unless necessary
- do not introduce abstractions early
- do not add libraries unless clearly justified
- preserve existing behavior unless the task explicitly changes it

After making changes:
- summarize what changed
- list assumptions
- list follow-up steps
- mention risky areas or anything that still needs validation

If requirements are ambiguous:
- make the smallest grounded assumption
- proceed with the smallest safe step

---

## 8. Development rules

- use migrations for schema changes
- keep changes small
- keep UI simple
- prefer reuse-first implementation over new patterns when an equivalent module already exists
- prioritize data speed and perceived speed for operational pages
- prefer relational clarity over clever abstractions
- explain functionality before code
- test each vertical slice before broadening scope
- avoid Prisma by default
- avoid heavy state libraries unless repeated pain proves they are needed
- do not recreate Glide computed/helper tables unless they are real business data
- do not build a generic workflow engine
- do not over-model tuning/setup before usage patterns are clear

---

## 9. Execution roadmap

### Phase 0 — Repository bootstrap
Objective:
Create a clean project foundation.

Deliverables:
- Next.js app with App Router and TypeScript
- Tailwind and shadcn/ui configured (https://ui.shadcn.com/blocks, https://ui.shadcn.com/docs/components)
- Supabase client setup
- environment variable strategy
- lint and format scripts
- base route groups and app shell

Done when:
- app runs locally
- a simple authenticated page can load
- environment variables are documented

### Phase 1 — Supabase project and local workflow
Objective:
Prepare the database and project workflow.

Deliverables:
- Supabase project created
- local repo linked to the remote project
- SQL migrations folder in repo
- first migration committed
- storage bucket plan documented

Done when:
- migration can be applied cleanly
- schema is reproducible from the repo
- team can avoid dashboard-only schema drift

### Phase 2 — Auth and user model
Objective:
Set up identity and role scaffolding.

Deliverables:
- Auth configured in Supabase
- `public.profiles` table
- organization memberships
- team memberships
- session-safe server-side auth helpers

Done when:
- a signed-in user can be resolved to a profile
- org/team memberships can be checked server-side

### Phase 3 — Core schema
Objective:
Implement the operational data model.

Deliverables:
- organizations
- teams
- venues
- team_venues
- camps
- sessions
- session_reviews
- session_setups
- session_assets

Done when:
- a realistic sample data flow can be inserted end to end
- foreign keys and indexes are in place

### Phase 4 — RLS and permissions
Objective:
Secure data access correctly.

Deliverables:
- RLS enabled everywhere in public schema
- policies for `super_admin`, `organization_admin`, `team_admin`, `coach`, and `crew`
- server-side helpers for safe mutations

Done when:
- users can only see permitted org/team data
- writes are restricted by role and context
- `service_role` is only used in trusted server environments

### Phase 5 — App shell and navigation
Objective:
Create the usable internal app shell.

Deliverables:
- signed-in layout
- organization/team switch patterns
- role-aware navigation
- basic dashboard landing page

Done when:
- users can navigate the main modules without dead ends

### Phase 6 — Operational CRUD flows
Objective:
Build the backbone workflows.

Deliverables:
- create and edit venues
- create and edit team venues
- create and edit camps
- create and edit sessions
- list/detail pages for each

Done when:
- the full chain `Team -> TeamVenue -> Camp -> Session` works in the UI

### Phase 7 — Session detail flows
Objective:
Support the real daily usage.

Deliverables:
- coach session review form
- crew setup / tuning form
- session highlight flag
- regatta result form for regatta sessions
- asset upload and management

Done when:
- a coach and a crew member can complete their parts of the same session cleanly

### Phase 8 — Extended modules (deferred)
Objective:
Add deferred modules after core operations are stable.

Deliverables:
- assessment model definition
- assessment workflow design
- phased implementation plan

Done when:
- deferred module requirements are validated and scheduled

### Phase 9 — Basic analytics and reporting views
Objective:
Expose the first useful metrics.

Deliverables:
- sessions count by camp
- total net time sailed by camp
- session history by team / venue / year
- highlighted sessions view
- basic filters

Done when:
- staff can answer common operational questions without external spreadsheets

### Phase 10 — PWA
Objective:
Make the app installable and mobile-friendly.

Deliverables:
- manifest
- icons
- installable app shell
- mobile nav review
- responsive forms and detail views

Done when:
- the app can be installed from supported browsers
- common workflows work well on phones

### Phase 11 — Gear module
Objective:
Add equipment tracking only after the core app is stable.

Deliverables:
- `gear_items`
- gear categories or roles
- `session_gear_usage`
- basic gear usage analytics

Done when:
- equipment can be attached to sessions
- usage counts support replacement planning

---

## 10. Suggested repository structure

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
  ui/
  layout/
  shared/
features/
  teams/
  venues/
  team-venues/
  camps/
  sessions/
lib/
  supabase/
  auth/
  db/
  validation/
  permissions/
supabase/
  migrations/
types/
```

---

## 11. Migration strategy from Glide

### Migrate directly
- users
- teams
- organizations
- venues
- camps
- sessions
- session setup
- session photos

### Do not migrate blindly
- Glide helper tables
- computed columns
- workflow workaround tables
- display-only helper values

### Replace with
- SQL views
- app queries
- server-side helpers
- derived metrics

---

## 12. First executable slice

Build this first:
1. bootstrap the repo
2. connect Supabase
3. commit the initial schema migration
4. add auth plumbing
5. render a protected dashboard shell

This creates the foundation for everything else.

---

## 13. Acceptance criteria for milestone 1

Milestone 1 is complete when:
- the repo runs locally
- Supabase is linked
- the initial schema exists in migrations
- a user can sign in
- a protected route can read the signed-in user
- the database structure matches the frozen domain model

---

## 14. How to use this with Codex

Use this file as the canonical project instruction document.

Recommended setup:
- place this content in the repo root as `AGENTS.md`
- archive or remove older overlapping planning docs
- if you keep a `PLAN.md`, make it a short pointer back to this document instead of a second source of truth
