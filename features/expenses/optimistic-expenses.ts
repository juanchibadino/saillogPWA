"use client"

import { useSyncExternalStore } from "react"

import type { ExpenseType } from "@/features/expenses/shared"

const EMPTY_OPTIMISTIC_EXPENSES: OptimisticTeamExpense[] = []

type OptimisticExpenseListener = () => void

export type OptimisticTeamExpense = {
  amountLabel: string
  amountLocal: number
  assignedMemberName: string
  assignedToProfileId: string
  convertedAmountLabel: string
  currencyCode: string
  description: string | null
  expenseDate: string
  expenseType: ExpenseType
  expenseYear: number
  id: string
  receiptFileName: string | null
  scopeOrgId: string
  scopeTeamId: string
  teamVenueId: string
  vendor: string
  venueName: string
}

let optimisticExpenses: OptimisticTeamExpense[] = EMPTY_OPTIMISTIC_EXPENSES
const listeners = new Set<OptimisticExpenseListener>()

function emitOptimisticExpenseChange(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribeToOptimisticExpenses(listener: OptimisticExpenseListener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function getOptimisticExpenseSnapshot(): OptimisticTeamExpense[] {
  return optimisticExpenses
}

function getServerOptimisticExpenseSnapshot(): OptimisticTeamExpense[] {
  return EMPTY_OPTIMISTIC_EXPENSES
}

export function addOptimisticTeamExpense(
  expense: OptimisticTeamExpense,
): string {
  optimisticExpenses = [
    expense,
    ...optimisticExpenses.filter((currentExpense) => currentExpense.id !== expense.id),
  ]
  emitOptimisticExpenseChange()

  return expense.id
}

export function removeOptimisticTeamExpense(expenseId: string): void {
  const nextExpenses = optimisticExpenses.filter((expense) => expense.id !== expenseId)

  if (nextExpenses.length === optimisticExpenses.length) {
    return
  }

  optimisticExpenses = nextExpenses
  emitOptimisticExpenseChange()
}

export function removeOptimisticTeamExpenses(expenseIds: string[]): void {
  if (expenseIds.length === 0) {
    return
  }

  const ids = new Set(expenseIds)
  const nextExpenses = optimisticExpenses.filter((expense) => !ids.has(expense.id))

  if (nextExpenses.length === optimisticExpenses.length) {
    return
  }

  optimisticExpenses = nextExpenses
  emitOptimisticExpenseChange()
}

export function useOptimisticTeamExpenses(): OptimisticTeamExpense[] {
  return useSyncExternalStore(
    subscribeToOptimisticExpenses,
    getOptimisticExpenseSnapshot,
    getServerOptimisticExpenseSnapshot,
  )
}
