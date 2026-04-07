# DB_SETUP.md

## Goal

Create the Supabase project correctly, connect it to the repository, and apply the initial schema with as little future rework as possible.

---

## Project creation choices

When creating the project in Supabase:

- **Project name:** `Sailog`
- **Postgres type:** choose **Postgres** (not `Postgres with OrioleDB`, which is still labeled alpha)
- **Enable Data API:** **ON**
- **Enable automatic RLS:** **ON**
- **Database password:** generate a strong password and store it in your password manager

### Region choice

Pick the region closest to the people who will use the app most.

Recommended rule:

- choose **Europe** if the daily operational users will mostly be in Palma / Hyeres / Europe
- choose **Americas** if the daily operational users will mostly be in Argentina / the Americas

If you are unsure and you are the main operator for now, `Americas` is a reasonable starting choice. But if most real production usage will happen in Europe, choose `Europe` now.

---

## Why these choices

- Data API should stay on because Supabase exposes your public schema through its API and the JavaScript client relies on that
- RLS should stay on because public tables without RLS are dangerous
- Automatic RLS is a good safety net for future tables
- Standard Postgres is the safe production choice

---

## After project creation

Open the project and collect these values from the dashboard:

### From **Connect**
- Project URL
- publishable key
- secret key
- database connection details

### From **Project Settings**
- project reference id

Store them securely.

---

## Recommended environment variables

Use names like these in your app:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_PROJECT_REF=
```

Legacy keys can still be supported for older projects:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

If you later need a direct Postgres connection for tooling, keep it separate and never expose it to the browser.

---

## Important database choices

### Use UTC

Keep the database timezone in UTC.

### Use migrations, not dashboard table editing

For the real app schema:

- create tables through SQL migrations in the repository
- do not build the production schema manually in the dashboard
- use the dashboard for inspection, not as the main source of truth

---

## Local workflow

### 1. Install the Supabase CLI

Use the official CLI installation flow for your machine.

### 2. Initialize Supabase in the repo

```bash
supabase init
```

This creates the local `supabase/` folder.

### 3. Link the repo to the remote project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. Create the first migration file

Example:

```bash
mkdir -p supabase/migrations
```

Then place the initial schema SQL in the migrations folder.

### 5. Apply the migration

You can apply migrations through your normal Supabase workflow after linking the project.

If you prefer to paste the SQL once in the SQL Editor to get moving, that is fine for the first pass, but the migration file should still be committed immediately so the repo remains the source of truth.

---

## Storage plan

Create these buckets later as part of setup:

- `session-photos`
- `session-files`

Do not make them public by default.
Secure them with policies later.

---

## First schema to apply

Use the provided `001_initial_schema.sql` as the starting migration.

That file includes:

- enums
- profiles
- organizations
- memberships
- teams
- venues
- team venue seasons
- camps
- sessions
- session detail tables
- assessment tables
- RLS enabled on all public tables

---

## Notes for Vercel and Next.js

For normal app access, you usually do not need raw Postgres credentials in frontend code.

Use:

- the Supabase URL
- the publishable key in the browser
- secure server-side access only where needed

Never expose:

- secret key
- raw database password

---

## Immediate next step after setup

Once the project exists and the repo is linked:

1. add the initial migration
2. apply it
3. verify the tables exist
4. move to auth + RLS policies
