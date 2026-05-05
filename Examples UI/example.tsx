'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table';
import DataTableSkeleton from '@/components/data-table-skeleton';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { PillFilter } from '@/components/pill-filter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import EditAdDialog from '@/app/tables/ad-edit';
import NewAdButton from '@/app/tables/ad-new';

type AdReference = { id: string | null; name: string | null } | null;

type AdListRow = {
  id: string;
  name: string;
  status: string | null;
  ad_type: 'new_concept' | 'iteration' | string | null;
  brief: AdReference;
  ad_group: AdReference;
  campaign: AdReference;
  client: AdReference;
  render_asset_id: string | null;
  updated_at: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  new_concept: 'Nuevo concepto',
  iteration: 'Iteración',
};

function AdActionsCell({ row, onChanged }: { row: AdListRow; onChanged?: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>Editar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditAdDialog
        id={row.id}
        initialName={row.name}
        open={open}
        onOpenChange={setOpen}
        onSaved={onChanged}
      />
    </div>
  );
}

const makeColumns = (onChanged?: () => void): ColumnDef<AdListRow>[] => [
  {
    accessorKey: 'name',
    header: 'Ad',
    cell: ({ row }) => (
      <Link
        href={`/ads/${encodeURIComponent(row.original.id)}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    id: 'client',
    header: 'Cliente',
    cell: ({ row }) => {
      const client = row.original.client;
      if (!client || !client.id) return <span className="text-muted-foreground">—</span>;
      const label = client.name ?? client.id;
      return (
        <Link
          href={`/clientes/${encodeURIComponent(client.id)}`}
          className="underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    id: 'campaign',
    header: 'Campaña',
    cell: ({ row }) => {
      const campaign = row.original.campaign;
      if (!campaign || !campaign.id) return <span className="text-muted-foreground">—</span>;
      const label = campaign.name ?? campaign.id;
      return (
        <Link
          href={`/campanias/${encodeURIComponent(campaign.id)}`}
          className="underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    id: 'brief',
    header: 'Brief',
    cell: ({ row }) => {
      const brief = row.original.brief;
      if (!brief || !brief.id) return <span className="text-muted-foreground">—</span>;
      const label = brief.name ?? brief.id;
      return (
        <Link
          href={`/briefs/${encodeURIComponent(brief.id)}`}
          className="underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    id: 'ad_group',
    header: 'Ad Group',
    cell: ({ row }) => {
      const adGroup = row.original.ad_group;
      if (!adGroup || !adGroup.id) return <span className="text-muted-foreground">—</span>;
      const label = adGroup.name ?? adGroup.id;
      return (
        <Link
          href={`/adgroups/${encodeURIComponent(adGroup.id)}`}
          className="underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    accessorKey: 'ad_type',
    header: 'Tipo',
    size: 120,
    cell: ({ row }) => {
      const type = row.original.ad_type;
      if (!type) return <span className="text-muted-foreground">—</span>;
      const key = String(type);
      return <Badge variant="secondary">{TYPE_LABELS[key] ?? key}</Badge>;
    },
  },
  {
    accessorKey: 'render_asset_id',
    header: 'Render',
    size: 110,
    cell: ({ row }) => {
      const rid = row.original.render_asset_id;
      return rid
        ? <Badge variant="default" className="font-mono text-[11px]" title={rid}>Render</Badge>
        : <Badge variant="destructive" className="text-[11px]">Sin render</Badge>;
    },
  },
  {
    id: 'actions',
    header: '',
    size: 80,
    cell: ({ row }) => <AdActionsCell row={row.original} onChanged={onChanged} />,
    enableSorting: false,
    enableHiding: false,
  },
];

export default function AdsPage() {
  const [rows, setRows] = React.useState<AdListRow[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const pageSize = 50;
  const searchParams = useSearchParams();
  const clientFilter = searchParams.get('client_id');
  const campaignFilter = searchParams.get('campaign_id');
  const briefFilter = searchParams.get('brief_id');
  const adGroupFilter = searchParams.get('ad_group_id');

  const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${BASE}/ads`);
      if (clientFilter && clientFilter.trim()) url.searchParams.set('client_id', clientFilter.trim());
      if (campaignFilter && campaignFilter.trim()) url.searchParams.set('campaign_id', campaignFilter.trim());
      if (adGroupFilter && adGroupFilter.trim()) url.searchParams.set('ad_group_id', adGroupFilter.trim());
      // brief filter remains client-side for now
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('offset', String(page * pageSize));
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        const message = typeof json?.error === 'string' && json.error.trim()
          ? json.error.trim()
          : `No se pudieron cargar los Ads (HTTP ${res.status}).`;
        setLoadError(message);
        setRows([]);
        return;
      }

      const items = (json.items as unknown[]).map((item) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const id = typeof obj.id === 'string' ? obj.id : null;
        const name = typeof obj.name === 'string' ? obj.name : null;
        if (!id || !name) return null;

        const brief = (() => {
          const direct = obj.brief;
          if (direct && typeof direct === 'object') {
            const ref = direct as Record<string, unknown>;
            const refId = typeof ref.id === 'string' ? ref.id : null;
            const refName = typeof ref.name === 'string' ? ref.name : null;
            if (refId || refName) return { id: refId, name: refName };
          }
          const refId = typeof obj.brief_id === 'string' ? obj.brief_id : null;
          const refName = typeof obj.brief_name === 'string' ? obj.brief_name : null;
          return refId || refName ? { id: refId, name: refName } : null;
        })();

        const adGroup = (() => {
          const direct = obj.ad_group;
          if (direct && typeof direct === 'object') {
            const ref = direct as Record<string, unknown>;
            const refId = typeof ref.id === 'string' ? ref.id : null;
            const refName = typeof ref.name === 'string' ? ref.name : null;
            if (refId || refName) return { id: refId, name: refName };
          }
          const refId = typeof obj.ad_group_id === 'string' ? obj.ad_group_id : null;
          const refName = typeof obj.ad_group_name === 'string' ? obj.ad_group_name : null;
          return refId || refName ? { id: refId, name: refName } : null;
        })();

        const campaign = (() => {
          const direct = obj.campaign;
          if (direct && typeof direct === 'object') {
            const ref = direct as Record<string, unknown>;
            const refId = typeof ref.id === 'string' ? ref.id : null;
            const refName = typeof ref.name === 'string' ? ref.name : null;
            if (refId || refName) return { id: refId, name: refName };
          }
          const refId = typeof obj.campaign_id === 'string' ? obj.campaign_id : null;
          const refName = typeof obj.campaign_name === 'string' ? obj.campaign_name : null;
          return refId || refName ? { id: refId, name: refName } : null;
        })();

        const client = (() => {
          const direct = obj.client;
          if (direct && typeof direct === 'object') {
            const ref = direct as Record<string, unknown>;
            const refId = typeof ref.id === 'string' ? ref.id : null;
            const refName = typeof ref.name === 'string' ? ref.name : null;
            if (refId || refName) return { id: refId, name: refName };
          }
          const refId = typeof obj.client_id === 'string' ? obj.client_id : null;
          const refName = typeof obj.client_name === 'string' ? obj.client_name : null;
          return refId || refName ? { id: refId, name: refName } : null;
        })();

        return {
          id,
          name,
          status: typeof obj.status === 'string' ? obj.status : null,
          ad_type: typeof obj.ad_type === 'string' ? obj.ad_type : null,
          brief,
          ad_group: adGroup,
          campaign,
          client,
          render_asset_id: typeof obj.render_asset_id === 'string' ? obj.render_asset_id : null,
          updated_at: typeof obj.updated_at === 'string' ? obj.updated_at : null,
        } satisfies AdListRow;
      }).filter((row): row is AdListRow => row !== null);

      setRows(items);
      setLoadError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al cargar los Ads.';
      setLoadError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [BASE, clientFilter, campaignFilter, adGroupFilter, page]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await reload();
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  React.useEffect(() => { setPage(0); }, [clientFilter, campaignFilter, briefFilter, adGroupFilter]);

  const clientOptions = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    rows.forEach((row) => {
      const id = row.client?.id;
      if (!id) return;
      const label = row.client?.name ?? id;
      const current = counts.get(id);
      if (current) current.count += 1; else counts.set(id, { label, count: 1 });
    });
    const options = Array.from(counts.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([id, info]) => ({ value: id, label: info.label, count: info.count }));
    return [{ value: null, label: 'Todos' } as const, ...options];
  }, [rows]);

  const campaignOptions = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    rows.forEach((row) => {
      const id = row.campaign?.id;
      if (!id) return;
      const label = row.campaign?.name ?? id;
      const current = counts.get(id);
      if (current) current.count += 1; else counts.set(id, { label, count: 1 });
    });
    const options = Array.from(counts.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([id, info]) => ({ value: id, label: info.label, count: info.count }));
    return [{ value: null, label: 'Todas' } as const, ...options];
  }, [rows]);

  const briefOptions = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    rows.forEach((row) => {
      const id = row.brief?.id;
      if (!id) return;
      const label = row.brief?.name ?? id;
      const current = counts.get(id);
      if (current) current.count += 1; else counts.set(id, { label, count: 1 });
    });
    const options = Array.from(counts.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([id, info]) => ({ value: id, label: info.label, count: info.count }));
    return [{ value: null, label: 'Todos' } as const, ...options];
  }, [rows]);

  const adGroupOptions = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    rows.forEach((row) => {
      const id = row.ad_group?.id;
      if (!id) return;
      const label = row.ad_group?.name ?? id;
      const current = counts.get(id);
      if (current) current.count += 1; else counts.set(id, { label, count: 1 });
    });
    const options = Array.from(counts.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([id, info]) => ({ value: id, label: info.label, count: info.count }));
    return [{ value: null, label: 'Todos' } as const, ...options];
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const clientId = clientFilter ? clientFilter.trim() : '';
    const campaignId = campaignFilter ? campaignFilter.trim() : '';
    const briefId = briefFilter ? briefFilter.trim() : '';
    const adGroupId = adGroupFilter ? adGroupFilter.trim() : '';
    return rows.filter((row) => {
      const byClient = clientId ? (row.client?.id ?? '') === clientId : true;
      const byCampaign = campaignId ? (row.campaign?.id ?? '') === campaignId : true;
      const byBrief = briefId ? (row.brief?.id ?? '') === briefId : true;
      const byAdGroup = adGroupId ? (row.ad_group?.id ?? '') === adGroupId : true;
      return byClient && byCampaign && byBrief && byAdGroup;
    });
  }, [rows, clientFilter, campaignFilter, briefFilter, adGroupFilter]);

  const selectedCampaignId = campaignFilter ? campaignFilter.trim() : '';
  const selectedBriefId = briefFilter ? briefFilter.trim() : '';
  const selectedAdGroupId = adGroupFilter ? adGroupFilter.trim() : '';
  const columns = React.useMemo(() => makeColumns(reload), [reload]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        title="Ads"
        columns={columns}
        data={filteredRows}
        empty={loading ? <DataTableSkeleton rows={10} /> : undefined}
        showColumnToggles={false}
        toolbarRight={(
          <ButtonGroup>
            <PillFilter
              param="client_id"
              title="Cliente"
              options={clientOptions}
              placeholder="Todos los clientes"
              searchable
            />
            <PillFilter
              param="campaign_id"
              title="Campaña"
              options={campaignOptions}
              placeholder="Todas las campañas"
              searchable
            />
            <PillFilter
              param="brief_id"
              title="Brief"
              options={briefOptions}
              placeholder="Todos los briefs"
              searchable
            />
            <PillFilter
              param="ad_group_id"
              title="Ad Group"
              options={adGroupOptions}
              placeholder="Todos los ad groups"
              searchable
            />
            <NewAdButton
              defaultCampaignId={selectedCampaignId || undefined}
              defaultBriefId={selectedBriefId || undefined}
              defaultAdGroupId={selectedAdGroupId || undefined}
              onCreated={reload}
            />
          </ButtonGroup>
        )}
      />
      <div className="flex items-center justify-end gap-2">
        <button className="text-sm underline disabled:opacity-50" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>Prev</button>
        <span className="text-sm text-muted-foreground">Página {page + 1}</span>
        <button className="text-sm underline disabled:opacity-50" onClick={() => setPage((p) => p + 1)} disabled={loading || rows.length < pageSize}>Next</button>
      </div>
    </main>
  );
}
