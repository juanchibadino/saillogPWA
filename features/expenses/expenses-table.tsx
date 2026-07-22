"use client"

import { useEffect, useState, useTransition } from "react"
import {
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MoreVerticalIcon,
  Trash2Icon,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { GradientCard } from "@/components/shared/gradient-card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteTeamExpenseAction } from "@/features/expenses/actions"
import type {
  TeamExpenseFormOptions,
  TeamExpenseListItem,
  TeamExpenseMetrics,
} from "@/features/expenses/data"
import { ExpenseFormDialog } from "@/features/expenses/expense-form-dialogs"
import { buildTeamExpensesPageHref } from "@/features/expenses/list-route-state.mjs"
import {
  removeOptimisticTeamExpenses,
  useOptimisticTeamExpenses,
  type OptimisticTeamExpense,
} from "@/features/expenses/optimistic-expenses"
import {
  formatExpenseDate,
  formatExpenseTypeLabel,
  type ExpenseVisibilityScope,
} from "@/features/expenses/shared"
import type { NavigationScope } from "@/lib/navigation/types"
import { cn } from "@/lib/utils"

type ExpensesPaginationItem = number | "ellipsis-start" | "ellipsis-end"

type PendingPageNavigation = {
  fromPage: number
  toPage: number
}

function isOptimisticExpenseVisible(input: {
  expense: OptimisticTeamExpense
  scope: NavigationScope
  selectedMemberId?: string
  selectedTeamVenueId?: string
  selectedType?: TeamExpenseListItem["expenseType"]
  selectedYear: number
}): boolean {
  if (input.expense.scopeOrgId !== input.scope.activeOrgId) {
    return false
  }

  if (input.scope.activeTeamId !== input.expense.scopeTeamId) {
    return false
  }

  if (input.expense.expenseYear !== input.selectedYear) {
    return false
  }

  if (
    input.selectedTeamVenueId &&
    input.expense.teamVenueId !== input.selectedTeamVenueId
  ) {
    return false
  }

  if (
    input.selectedMemberId &&
    input.expense.assignedToProfileId !== input.selectedMemberId
  ) {
    return false
  }

  if (input.selectedType && input.expense.expenseType !== input.selectedType) {
    return false
  }

  return true
}

function doesServerExpenseMatchOptimistic(
  expense: TeamExpenseListItem,
  optimisticExpense: OptimisticTeamExpense,
): boolean {
  return (
    expense.teamVenueId === optimisticExpense.teamVenueId &&
    expense.assignedToProfileId === optimisticExpense.assignedToProfileId &&
    expense.expenseDate === optimisticExpense.expenseDate &&
    expense.expenseType === optimisticExpense.expenseType &&
    expense.vendor.trim() === optimisticExpense.vendor.trim() &&
    Math.abs(expense.amountLocal - optimisticExpense.amountLocal) < 0.01
  )
}

function buildExpensesPaginationItems(
  currentPage: number,
  pageCount: number,
): ExpensesPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: ExpensesPaginationItem[] = [1]
  const middleStart = Math.max(2, currentPage - 1)
  const middleEnd = Math.min(pageCount - 1, currentPage + 1)

  if (middleStart > 2) {
    items.push("ellipsis-start")
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page)
  }

  if (middleEnd < pageCount - 1) {
    items.push("ellipsis-end")
  }

  items.push(pageCount)

  return items
}

function ExpenseMetricsStrip({
  metrics,
  visibilityScope,
}: {
  metrics: TeamExpenseMetrics
  visibilityScope: ExpenseVisibilityScope
}) {
  if (visibilityScope === "team" && metrics.teamTotalLabel) {
    return (
      <GradientCard className="px-4 py-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Team Expenses</p>
        <p className="mt-1 text-lg font-semibold">{metrics.teamTotalLabel}</p>
      </GradientCard>
    )
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <GradientCard className="px-4 py-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">My Expenses</p>
        <p className="mt-1 text-lg font-semibold">{metrics.myTotalLabel}</p>
      </GradientCard>
      {metrics.teamTotalLabel ? (
        <GradientCard className="px-4 py-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Team Expenses</p>
          <p className="mt-1 text-lg font-semibold">{metrics.teamTotalLabel}</p>
        </GradientCard>
      ) : null}
    </div>
  )
}

function ExpenseReceiptActions({ expense }: { expense: TeamExpenseListItem }) {
  if (!expense.receiptUrl) {
    return <span className="text-xs text-muted-foreground">No receipt</span>
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <a
        href={expense.receiptUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open receipt for ${expense.vendor}`}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "h-9 w-9")}
      >
        <ExternalLinkIcon className="size-4" />
      </a>
      {expense.receiptDownloadUrl ? (
        <a
          href={expense.receiptDownloadUrl}
          aria-label={`Download receipt for ${expense.vendor}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "h-9 w-9")}
        >
          <DownloadIcon className="size-4" />
        </a>
      ) : null}
    </div>
  )
}

function ExpenseActionsMenu({
  expense,
  formOptions,
  scope,
  surface = "sheet",
}: {
  expense: TeamExpenseListItem
  formOptions: TeamExpenseFormOptions
  scope: NavigationScope
  surface?: "drawer" | "sheet"
}) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(): Promise<void> {
    if (isDeleting || !expense.canDelete) {
      return
    }

    const confirmed = window.confirm(`Delete expense from ${expense.vendor}?`)

    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    const formData = new FormData()
    formData.set("expenseId", expense.id)
    formData.set("scopeOrgId", scope.activeOrgId)

    if (scope.activeTeamId) {
      formData.set("scopeTeamId", scope.activeTeamId)
    }

    const result = await deleteTeamExpenseAction(formData)

    if (!result.ok) {
      toast.error(result.message)
      setIsDeleting(false)
      return
    }

    toast.success(result.message)
    router.refresh()
    setIsDeleting(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" disabled={isDeleting} />
        }
      >
        {isDeleting ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <MoreVerticalIcon className="size-4" />
        )}
        <span className="sr-only">Expense actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {expense.receiptUrl ? (
          <>
            <DropdownMenuLinkItem
              href={expense.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="gap-2"
            >
              <ExternalLinkIcon className="size-4" />
              Open receipt
            </DropdownMenuLinkItem>
            {expense.receiptDownloadUrl ? (
              <DropdownMenuLinkItem href={expense.receiptDownloadUrl} className="gap-2">
                <DownloadIcon className="size-4" />
                Download receipt
              </DropdownMenuLinkItem>
            ) : null}
          </>
        ) : null}

        {expense.canEdit ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
            }}
          >
            <ExpenseFormDialog
              expense={expense}
              mode="edit"
              options={formOptions}
              scope={scope}
              surface={surface}
              triggerVariant="button"
            />
          </DropdownMenuItem>
        ) : null}

        {expense.canDelete ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={isDeleting}
            onClick={() => {
              void handleDelete()
            }}
          >
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExpenseMobileCard({
  expense,
  formOptions,
  scope,
  visibilityScope,
}: {
  expense: TeamExpenseListItem
  formOptions: TeamExpenseFormOptions
  scope: NavigationScope
  visibilityScope: ExpenseVisibilityScope
}) {
  return (
    <GradientCard className="px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{expense.vendor}</p>
            <Badge variant="outline" className="shrink-0">
              {formatExpenseTypeLabel(expense.expenseType)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatExpenseDate(expense.expenseDate)} - {expense.venueName}
          </p>
          {expense.campName ? (
            <p className="truncate text-xs text-muted-foreground">{expense.campName}</p>
          ) : null}
          {visibilityScope === "team" ? (
            <p className="truncate text-xs text-muted-foreground">{expense.assignedMemberName}</p>
          ) : null}
          {expense.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {expense.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-semibold">{expense.convertedAmountLabel}</span>
            <span className="text-xs text-muted-foreground">{expense.amountLabel}</span>
          </div>
        </div>
        <ExpenseActionsMenu
          expense={expense}
          formOptions={formOptions}
          scope={scope}
          surface="drawer"
        />
      </div>
    </GradientCard>
  )
}

function SavingExpenseBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 border-primary/40 bg-primary/5 text-primary"
    >
      <Loader2Icon className="size-3 animate-spin" />
      Saving
    </Badge>
  )
}

function OptimisticExpenseMobileCard({
  expense,
  visibilityScope,
}: {
  expense: OptimisticTeamExpense
  visibilityScope: ExpenseVisibilityScope
}) {
  return (
    <GradientCard className="border-primary/30 bg-primary/5 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{expense.vendor}</p>
            <SavingExpenseBadge />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatExpenseDate(expense.expenseDate)} - {expense.venueName}
          </p>
          {visibilityScope === "team" ? (
            <p className="truncate text-xs text-muted-foreground">
              {expense.assignedMemberName}
            </p>
          ) : null}
          {expense.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {expense.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-semibold">{expense.convertedAmountLabel}</span>
            <span className="text-xs text-muted-foreground">{expense.amountLabel}</span>
          </div>
        </div>
        <div
          role="status"
          aria-label="Saving expense"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background/80 text-muted-foreground"
        >
          <Loader2Icon className="size-4 animate-spin" />
        </div>
      </div>
    </GradientCard>
  )
}

function OptimisticExpenseTableRow({
  expense,
  visibilityScope,
}: {
  expense: OptimisticTeamExpense
  visibilityScope: ExpenseVisibilityScope
}) {
  return (
    <TableRow aria-live="polite" className="bg-primary/5 hover:bg-primary/5">
      <TableCell className="whitespace-nowrap">
        {formatExpenseDate(expense.expenseDate)}
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex max-w-56 items-center gap-2">
          <span className="truncate">{expense.vendor}</span>
          <SavingExpenseBadge />
        </div>
        {expense.description ? (
          <div className="max-w-56 truncate text-xs text-muted-foreground">
            {expense.description}
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <div className="max-w-48 truncate">{expense.venueName}</div>
      </TableCell>
      {visibilityScope === "team" ? (
        <TableCell className="max-w-40 truncate">
          {expense.assignedMemberName}
        </TableCell>
      ) : null}
      <TableCell>{formatExpenseTypeLabel(expense.expenseType)}</TableCell>
      <TableCell className="text-right">{expense.amountLabel}</TableCell>
      <TableCell className="text-right font-medium">
        {expense.convertedAmountLabel}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {expense.receiptFileName ? "Uploading" : "No receipt"}
      </TableCell>
      <TableCell className="text-right">
        <div
          role="status"
          aria-label="Saving expense"
          className="ml-auto flex size-8 items-center justify-center rounded-full text-muted-foreground"
        >
          <Loader2Icon className="size-4 animate-spin" />
        </div>
      </TableCell>
    </TableRow>
  )
}

export function TeamExpensesTable({
  currentPage,
  expenses,
  formOptions,
  hasNextPage,
  hasPreviousPage,
  metrics,
  pageCount,
  scope,
  selectedMemberId,
  selectedTeamVenueId,
  selectedType,
  selectedYear,
  visibilityScope,
}: {
  currentPage: number
  expenses: TeamExpenseListItem[]
  formOptions: TeamExpenseFormOptions
  hasNextPage: boolean
  hasPreviousPage: boolean
  metrics: TeamExpenseMetrics
  pageCount: number
  scope: NavigationScope
  selectedMemberId?: string
  selectedTeamVenueId?: string
  selectedType?: TeamExpenseListItem["expenseType"]
  selectedYear: number
  visibilityScope: ExpenseVisibilityScope
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoadingMore, startLoadMoreTransition] = useTransition()
  const [isPageNavigationPending, startPageNavigationTransition] = useTransition()
  const [pendingPageNavigation, setPendingPageNavigation] =
    useState<PendingPageNavigation | null>(null)
  const optimisticExpenses = useOptimisticTeamExpenses()
  const visibleOptimisticExpenses = optimisticExpenses.filter((expense) =>
    isOptimisticExpenseVisible({
      expense,
      scope,
      selectedMemberId,
      selectedTeamVenueId,
      selectedType,
      selectedYear,
    }),
  )
  const paginationItems = buildExpensesPaginationItems(currentPage, pageCount)
  const isPaginationBusy =
    isPageNavigationPending || pendingPageNavigation?.fromPage === currentPage
  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)
  const columnCount = visibilityScope === "team" ? 9 : 8
  const hasVisibleExpenses = expenses.length > 0 || visibleOptimisticExpenses.length > 0

  useEffect(() => {
    const matchedOptimisticExpenseIds = optimisticExpenses
      .filter((optimisticExpense) =>
        expenses.some((expense) =>
          doesServerExpenseMatchOptimistic(expense, optimisticExpense),
        ),
      )
      .map((expense) => expense.id)

    removeOptimisticTeamExpenses(matchedOptimisticExpenseIds)
  }, [expenses, optimisticExpenses])

  function buildPageHref(nextPageNumber: number, includeLoadMore = false): string {
    return buildTeamExpensesPageHref({
      pathname,
      search: searchParams.toString(),
      nextPage: nextPageNumber,
      includeLoadMore,
    })
  }

  function navigateToPage(nextPageNumber: number): void {
    if (
      isPaginationBusy ||
      nextPageNumber === currentPage ||
      nextPageNumber < 1 ||
      nextPageNumber > pageCount
    ) {
      return
    }

    setPendingPageNavigation({
      fromPage: currentPage,
      toPage: nextPageNumber,
    })
    startPageNavigationTransition(() => {
      router.push(buildPageHref(nextPageNumber))
    })
  }

  return (
    <section className="space-y-4">
      <ExpenseMetricsStrip metrics={metrics} visibilityScope={visibilityScope} />

      <div className="space-y-2 md:hidden">
        {!hasVisibleExpenses ? (
          <GradientCard className="px-4 py-6 text-sm text-muted-foreground">
            No expenses found for this view.
          </GradientCard>
        ) : (
          <>
            {visibleOptimisticExpenses.map((expense) => (
              <OptimisticExpenseMobileCard
                key={expense.id}
                expense={expense}
                visibilityScope={visibilityScope}
              />
            ))}
            {expenses.map((expense) => (
              <ExpenseMobileCard
                key={expense.id}
                expense={expense}
                formOptions={formOptions}
                scope={scope}
                visibilityScope={visibilityScope}
              />
            ))}
          </>
        )}

        {hasNextPage ? (
          <div className="pb-4 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={isLoadingMore}
              aria-label="Load more expenses"
              className="h-11 w-full"
              onClick={() => {
                startLoadMoreTransition(() => {
                  router.push(buildPageHref(currentPage + 1, true))
                })
              }}
            >
              {isLoadingMore ? <Loader2Icon className="size-4 animate-spin" /> : null}
              <span>{isLoadingMore ? "Loading more..." : "Load more expenses"}</span>
            </Button>
          </div>
        ) : null}
      </div>

      <GradientCard
        aria-busy={isPaginationBusy}
        className="relative hidden overflow-hidden p-0 md:block"
      >
        <div
          aria-disabled={isPaginationBusy}
          className={cn(
            "transition-opacity",
            isPaginationBusy && "pointer-events-none select-none opacity-40",
          )}
        >
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Venue</TableHead>
                {visibilityScope === "team" ? <TableHead>Member</TableHead> : null}
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Local</TableHead>
                <TableHead className="text-right">Converted</TableHead>
                <TableHead className="w-28 text-right">Receipt</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hasVisibleExpenses ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="py-6 text-sm text-muted-foreground">
                    No expenses found for this view.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {visibleOptimisticExpenses.map((expense) => (
                    <OptimisticExpenseTableRow
                      key={expense.id}
                      expense={expense}
                      visibilityScope={visibilityScope}
                    />
                  ))}
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatExpenseDate(expense.expenseDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="max-w-56 truncate">{expense.vendor}</div>
                        {expense.description ? (
                          <div className="max-w-56 truncate text-xs text-muted-foreground">
                            {expense.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-48 truncate">{expense.venueName}</div>
                        {expense.campName ? (
                          <div className="max-w-48 truncate text-xs text-muted-foreground">
                            {expense.campName}
                          </div>
                        ) : null}
                      </TableCell>
                      {visibilityScope === "team" ? (
                        <TableCell className="max-w-40 truncate">
                          {expense.assignedMemberName}
                        </TableCell>
                      ) : null}
                      <TableCell>{formatExpenseTypeLabel(expense.expenseType)}</TableCell>
                      <TableCell className="text-right">{expense.amountLabel}</TableCell>
                      <TableCell className="text-right font-medium">
                        {expense.convertedAmountLabel}
                      </TableCell>
                      <TableCell className="text-right">
                        <ExpenseReceiptActions expense={expense} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ExpenseActionsMenu
                          expense={expense}
                          formOptions={formOptions}
                          scope={scope}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {isPaginationBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
            <div
              role="status"
              aria-label="Loading expenses"
              className="flex size-11 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm"
            >
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </GradientCard>

      {pageCount > 1 ? (
        <Pagination className="hidden justify-end md:flex">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!hasPreviousPage || isPaginationBusy}
                disabled={!hasPreviousPage || isPaginationBusy}
                onClick={(event) => {
                  event.preventDefault()
                  if (hasPreviousPage) {
                    navigateToPage(previousPage)
                  }
                }}
              />
            </PaginationItem>
            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === currentPage}
                    aria-current={item === currentPage ? "page" : undefined}
                    disabled={isPaginationBusy}
                    onClick={(event) => {
                      event.preventDefault()
                      navigateToPage(item)
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                aria-disabled={!hasNextPage || isPaginationBusy}
                disabled={!hasNextPage || isPaginationBusy}
                onClick={(event) => {
                  event.preventDefault()
                  if (hasNextPage) {
                    navigateToPage(nextPage)
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  )
}
