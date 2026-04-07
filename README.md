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

## Vercel Environment Variables

Set these in Vercel for both Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Set only when needed for trusted server operations:

- `SUPABASE_SECRET_KEY`

Do not expose secret keys in client code or with `NEXT_PUBLIC_`.

## Supabase Runtime Helpers

- `createBrowserSupabaseClient()` in `lib/supabase/browser.ts`
- `createServerSupabaseClient()` in `lib/supabase/server.ts`
- `createAdminSupabaseClient()` in `lib/supabase/admin.ts`

The env contract is centralized in `lib/supabase/env.ts`.
