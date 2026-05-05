// src/components/filters/pill-filter.tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';

export type PillOption = {
  /** Valor que se setea en el query param; si es null, limpia el parámetro */
  value: string | null;
  /** Texto visible en el item */
  label: string;
  /** (Opcional) contador a la derecha (estilo screenshot) */
  count?: number;
  /** (Opcional) icono a la izquierda del label */
  icon?: React.ReactNode;
};

export type PillFilterProps = {
  /** Clave del parámetro en la URL, ej: "status" | "campaign_id" */
  param: string;
  /** Título del filtro (aparece en el pill), ej: "Status" | "Campaña" */
  title: string;
  /** Opciones del dropdown (incluí una con value:null para “Todos/Todas…”) */
  options: PillOption[];
  /** Placeholder cuando no hay valor seleccionado (default: "Todos") */
  placeholder?: string;
  /** Alineación del dropdown respecto del trigger (default: "end") */
  align?: 'start' | 'end' | 'center';
  /** Clase extra para el botón pill */
  className?: string;
  /** Habilita el campo de búsqueda dentro del dropdown (default: false) */
  searchable?: boolean;
  /** Placeholder del input de búsqueda (default: "Buscar…") */
  searchPlaceholder?: string;
};

/* ----------------------------- utils & hooks ----------------------------- */

function useDebounced<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function normalizeNoDia(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function HighlightedLabel({ label, query }: { label: string; query: string }) {
  if (!query.trim()) return <span className="truncate">{label}</span>;
  const qRaw = query.trim();
  const normLabel = normalizeNoDia(label);
  const normQuery = normalizeNoDia(qRaw);
  const idx = normLabel.indexOf(normQuery);
  if (idx === -1) return <span className="truncate">{label}</span>;

  // Mapear indices del string normalizado al original (mantener acentos)
  // Para simplicidad: tomamos el mismo slice por longitud del query original
  const before = label.slice(0, idx);
  const mid = label.slice(idx, idx + qRaw.length);
  const after = label.slice(idx + qRaw.length);

  return (
    <span className="truncate">
      {before}
      <span className="bg-muted rounded px-0.5">{mid}</span>
      {after}
    </span>
  );
}

/* --------------------------------- component -------------------------------- */

export function PillFilter({
  param,
  title,
  options,
  placeholder = 'Todos',
  align = 'end',
  className,
  searchable = false,
  searchPlaceholder = 'Buscar…',
}: PillFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentVal = sp.get(param) ?? null;
  const selected = options.find(o => (o.value ?? null) === currentVal) ?? null;
  const label = `${title}: ${selected ? selected.label : placeholder}`;

  const [query, setQuery] = React.useState('');
  const debounced = useDebounced(query, 200);

  const filtered = React.useMemo(() => {
    if (!searchable || !debounced.trim()) return options;
    const q = normalizeNoDia(debounced.trim());
    return options.filter(o => normalizeNoDia(o.label).includes(q));
  }, [options, searchable, debounced]);

  const setParam = (value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === '') next.delete(param);
    else next.set(param, value);
    const url = `${pathname}${next.toString() ? `?${next.toString()}` : ''}`;
    router.replace(url, { scroll: false });
    // Asegura re-render del árbol de Server Components y refetch
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${className ?? ''}`}
        >
          <span className="truncate max-w-[200px]">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {title}
        </DropdownMenuLabel>

        {searchable ? (
          <>
            <div className="px-2 py-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8"
              />
            </div>
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuSeparator />
        )}

        {filtered.map((opt) => {
          const isActive = (opt.value ?? null) === currentVal;
          return (
            <DropdownMenuItem
              key={`${opt.label}-${opt.value ?? 'null'}`}
              onClick={() => setParam(opt.value)}
              className="flex items-center gap-2"
            >
              <span className="w-4">
                {isActive ? <Check className="h-4 w-4" /> : null}
              </span>

              {opt.icon ? <span className="opacity-80">{opt.icon}</span> : null}

              <div className="flex-1 min-w-0">
                <HighlightedLabel label={opt.label} query={debounced} />
              </div>

              {typeof opt.count === 'number' ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {opt.count}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}

        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
