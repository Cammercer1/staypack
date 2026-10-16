import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { redirect } from "next/navigation";

export const metadata = { title: "Contacts", robots: { index: false, follow: false } };
export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireAgency();
  const { client } = await searchParams;
  redirect(z.uuid().safeParse(client).success ? `/contacts?contact=${client}` : "/contacts");
}
