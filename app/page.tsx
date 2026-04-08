import { redirect } from "next/navigation";

import { getCurrentAccessContext } from "@/lib/auth/access";

export default async function Home() {
  const context = await getCurrentAccessContext();

  if (context.user) {
    redirect("/dashboard");
  }

  redirect("/sign-in");
}
