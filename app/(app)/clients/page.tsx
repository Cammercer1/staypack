import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { ClientsDirectory } from "@/components/clients/ClientsDirectory";

export const metadata = { title: "Clients", robots: { index: false, follow: false } };
export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireAgency();
  const { client } = await searchParams;
  return <ClientsDirectory initialClientId={z.uuid().safeParse(client).success ? client : undefined} />;
}
