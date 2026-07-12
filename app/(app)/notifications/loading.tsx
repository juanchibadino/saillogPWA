import { Skeleton } from "@/components/ui/skeleton"

export default function NotificationsLoading() {
  return (
    <main className="-m-4 flex min-h-[calc(100dvh-var(--mobile-header-total-height))] flex-col bg-background p-4 md:m-0 md:min-h-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </main>
  )
}
