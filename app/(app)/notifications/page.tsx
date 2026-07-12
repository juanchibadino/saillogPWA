import { NotificationCenterClient } from "@/features/notifications/notification-center-client"
import { getNotificationCenterData } from "@/features/notifications/data"

export default async function NotificationsPage() {
  const notificationData = await getNotificationCenterData({ limit: 100 })

  return (
    <main className="-m-4 flex min-h-[calc(100dvh-var(--mobile-header-total-height))] flex-col bg-background md:m-0 md:min-h-0">
      <div className="flex min-h-0 flex-1 flex-col md:mx-auto md:w-full md:max-w-3xl">
        <NotificationCenterClient initialData={notificationData} mode="page" />
      </div>
    </main>
  )
}
