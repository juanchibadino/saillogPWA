import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-5 py-14">
      <Card className="w-full rounded-3xl border-[var(--line)] bg-[var(--card)] shadow-sm">
        <CardHeader className="space-y-4">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Sistema de Marcos
          </p>
          <CardTitle className="max-w-3xl text-4xl leading-tight font-semibold text-[var(--ink)] md:text-5xl">
            Configurador publico + backoffice operativo para cotizar, producir y medir margen.
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm text-muted-foreground md:text-base">
            V1 simplificado con catalogo curado propio, matching exacto y flujo lead→quote→job→purchase
            con proveedor manual en compras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/configurador"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Ir al configurador publico
            </Link>
            <Link
              href="/admin/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
            >
              Ir al backoffice
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
