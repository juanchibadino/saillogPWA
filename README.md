# Sailog

Internal sailing operations app built with Next.js App Router and Supabase.

## Quickstart

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Fill required values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Optional (server-only):

```env
SUPABASE_SECRET_KEY=
SUPABASE_PROJECT_REF=
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_PRO_MONTHLY_PLAN_ID=
PAYPAL_PRO_YEARLY_PLAN_ID=
```

Recommended for stable magic-link redirects:

```env
# Local: http://localhost:3000
# Production: https://sailog.vercel.app
NEXT_PUBLIC_APP_URL=
```

Legacy fallback vars are still accepted by the helper layer:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Run the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Milestone 1 Auth Routes

- `/sign-in` request an email magic link
- `/auth/callback` exchange auth code for session
- `/dashboard` protected app area
- `/sign-out` clear session

## Magic Link Redirect Setup

If magic links send users to `localhost` from production, verify both app env
and Supabase Auth settings:

1. Set `NEXT_PUBLIC_APP_URL`:
   - local: `http://localhost:3000`
   - production: `https://sailog.vercel.app`
2. In Supabase **Auth > URL Configuration**:
   - Site URL: `https://sailog.vercel.app`
   - Redirect URLs should include:
     - `http://localhost:3000/auth/callback`
     - `https://sailog.vercel.app/auth/callback`
     - optional preview pattern: `https://sailog-*.vercel.app/auth/callback`

## Apply Migrations

After pulling latest changes, apply migrations so profile bootstrap trigger and
RLS policies are available:

```bash
npx supabase db push
```

## First Access Grant Sequence (SQL Editor)

If you see this error while granting access:

`ERROR: P0001: No auth user found for that email yet`

it means the user has not been created in `auth.users` yet. In Sailog, the user
must request the magic link first from `/sign-in`.

1. Ask the user to request a magic link at `/sign-in`.
2. In Supabase SQL Editor, verify the user exists:

```sql
select id, email
from auth.users
where lower(email) = lower('<email>');

select id, email
from public.profiles
where lower(email) = lower('<email>');
```

3. Grant memberships using `insert ... select` (no `RAISE` blocks):

```sql
insert into public.organization_memberships (organization_id, profile_id, role)
select
  '<organization_id>'::uuid,
  u.id,
  'organization_admin'::public.organization_role_type
from auth.users u
where lower(u.email) = lower('<email>')
on conflict (organization_id, profile_id, role) do nothing;

insert into public.team_memberships (team_id, profile_id, role, is_active)
select
  '<team_id>'::uuid,
  u.id,
  'coach'::public.team_role_type,
  true
from auth.users u
where lower(u.email) = lower('<email>')
on conflict (team_id, profile_id, role) do update
set
  is_active = true,
  left_at = null;
```

4. Confirm behavior:
   - user without memberships sees `Access pending`
   - user with membership can open `/dashboard`

## Milestone 1 Local Validation Checklist

- `npm run lint`
- `npm run build`
- `/sign-in` sends OTP email
- `/auth/callback` creates session and redirects to `/dashboard`
- `/dashboard` shows pending access without memberships
- `/dashboard` shows role cards after membership grants

## Vercel Environment Variables

Set these in Vercel for both Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Set only when needed for trusted server operations:

- `SUPABASE_SECRET_KEY`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

Do not expose secret keys in client code or with `NEXT_PUBLIC_`.

## Billing Webhook Notes

- PayPal webhook route: `/api/billing/paypal/webhook`
- Configure the webhook URL in PayPal dashboard for the same environment defined by `PAYPAL_ENV`.
- Keep `PAYPAL_WEBHOOK_ID` synced with the webhook id for that exact environment.

## Supabase Runtime Helpers

- `createBrowserSupabaseClient()` in `lib/supabase/browser.ts`
- `createServerSupabaseClient()` in `lib/supabase/server.ts`
- `createAdminSupabaseClient()` in `lib/supabase/admin.ts`

The env contract is centralized in `lib/supabase/env.ts`.
