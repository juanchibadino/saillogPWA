'use client';

import * as React from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Texto del título de la tabla (H1 en toolbar) */
  title?: string;
  /**
   * Acción "nuevo" opcional.
   * Si es null/undefined, no se renderiza el botón.
   */
  newAction?:
  | {
    label: string;
    href: string;
    icon?: React.ReactNode;
  }
  | React.ReactNode
  | null;
  /** Nodo opcional para el extremo derecho de la toolbar (filtros extras, etc.) */
  toolbarRight?: React.ReactNode;
  empty?: React.ReactNode;
  showColumnToggles?: boolean;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  title = undefined,
  newAction = null,
  toolbarRight,
  showColumnToggles = false,
  empty = <div className="p-8 text-sm text-muted-foreground">Sin datos.</div>,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  type NewActionObj = { label: string; href: string; icon?: React.ReactNode };

  function isNewActionObj(val: unknown): val is NewActionObj {
    if (!val || typeof val !== 'object' || React.isValidElement(val)) return false;
    const obj = val as Record<string, unknown>;
    return typeof obj.label === 'string' && typeof obj.href === 'string';
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {/* Toolbar (3 zonas: izquierda = título, centro = filtros, derecha = botón Nuevo) */}
      <div className="flex items-center gap-2">
        {/* IZQUIERDA: título */}
        <div className="text-sm text-muted-foreground mr-auto">
          {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
        </div>

        {/* CENTRO: toggles (opt-in) + filtros (toolbarRight) */}
        <div className="flex items-center gap-2">
          {showColumnToggles ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                Columnas
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {table
                  .getAllColumns()
                  .filter((c) => typeof c.accessorFn !== 'undefined' && c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      className="capitalize"
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    >
                      {c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {toolbarRight ?? null}
        </div>

        {/* DERECHA: botón "Nuevo" */}
        <div className="flex items-center">
          {newAction
            ? isNewActionObj(newAction)
              ? (
                <Link
                  href={newAction.href}
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'sm',
                    className: 'gap-2',
                  })}
                >
                  {newAction.icon ?? <PlusIcon />}
                  <span className="hidden lg:inline">{newAction.label}</span>
                </Link>
              )
              : React.isValidElement(newAction)
                ? newAction
                : null
            : null}
        </div>
      </div>

      {/* Tabla + footer de paginación */}
      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="[&_th]:h-10">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Footer de paginación */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-xs">Filas por página</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="w-20" size="sm">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((n) => (
                  <SelectItem key={n} value={`${n}`}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full items-center gap-3 md:w-auto md:ml-auto">
            <div className="text-xs">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label="Primera página"
              >«</Button>
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Página anterior"
              >‹</Button>
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Página siguiente"
              >›</Button>
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label="Última página"
              >»</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
