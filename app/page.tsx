import { redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import { getSession } from "@/lib/auth";

export default async function Page() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <HomePage />;
}
