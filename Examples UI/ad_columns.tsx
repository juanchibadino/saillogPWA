'use client';

import * as React from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import EditAdDialog from '../tables/ad-edit';

export type AdRow = {
  id: string;
  name: string;
  ad_type?: 'new_concept' | 'iteration';
  ad_iteration_ref?: string | null;
  parent_name?: string | null;
  ad_assets?: string[];
  render_asset_id?: string | null;
  updated_at?: string | null;
};

function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export const adColumns: ColumnDef<AdRow>[] = [
  {
    accessorKey: 'name',
    header: 'Ad',
    cell: ({ row }) => (
      <Link
        href={`/ads/${encodeURIComponent(row.original.id)}`}
        className="font-medium underline underline-offset-4 hover:no-underline"
      >
        {row.original.name}
      </Link>
    ),
    size: 240,
  },
  {
    accessorKey: 'ad_type',
    header: 'Type',
    cell: ({ row }) => {
      const t = row.original.ad_type;
      if (!t) return <span className="text-muted-foreground">—</span>;
      return <Badge variant="secondary">{t === 'iteration' ? 'Iteration' : 'New'}</Badge>;
    },
    size: 120,
  },
  {
    id: 'parent',
    header: 'Parent',
    cell: ({ row }) => {
      const parent = row.original.ad_iteration_ref;
      const parentName = row.original.parent_name;
      return parent ? (
        <Link
          href={`/ads/${encodeURIComponent(parent)}`}
          className="text-muted-foreground underline underline-offset-4 hover:no-underline"
          title={parent}
        >
          {parentName?.trim() ? parentName.trim() : parent}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
    size: 160,
  },
  {
    id: 'render',
    header: 'Render',
    cell: ({ row }) => {
      const rid = row.original.render_asset_id;
      if (!rid) {
        return (
          <Badge variant="destructive" className="font-medium text-[11px]">
            Sin render
          </Badge>
        );
      }
      return (
        <Badge variant="default" className="font-mono text-[11px]" title={rid}>
          Render
        </Badge>
      );
    },
    size: 120,
  },
  {
    id: 'assets',
    header: 'Assets',
    cell: ({ row }) => {
      const count = row.original.ad_assets?.length ?? 0;
      return <Badge variant="secondary">{count}</Badge>;
    },
    size: 90,
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.updated_at)}</span>,
    size: 130,
  },
  {
    id: 'actions',
    header: '',
    size: 60,
    cell: ({ row }) => <ActionsCell id={row.original.id} name={row.original.name} />,
    enableSorting: false,
    enableHiding: false,
  },
];

function ActionsCell({ id, name }: { id: string; name: string }) {
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
      <EditAdDialog id={id} initialName={name} open={open} onOpenChange={setOpen} />
    </div>
  );
}
