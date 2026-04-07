import { getSupabasePublicEnv } from "@/lib/supabase/env";

export default function Home() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicEnv();

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 rounded-2xl border border-slate-200 bg-white p-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Sailog
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Next.js bootstrap completed
          </h1>
          <p className="text-sm text-slate-600">
            The app is running with App Router and minimal Supabase runtime
            wiring.
          </p>
        </header>

        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-100 p-4">
          <p className="text-sm font-medium text-slate-700">
            Connected public Supabase URL
          </p>
          <code className="block break-all text-sm text-slate-800">
            {NEXT_PUBLIC_SUPABASE_URL}
          </code>
        </section>
      </div>
    </main>
  );
}
