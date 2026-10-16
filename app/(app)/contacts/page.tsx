import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { ClientsDirectory } from "@/components/clients/ClientsDirectory";

export const metadata = { title: "Contacts", robots: { index: false, follow: false } };
export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  await requireAgency();
  const { contact } = await searchParams;
  return <ClientsDirectory key={contact ?? "directory"} initialClientId={z.uuid().safeParse(contact).success ? contact : undefined} />;
}
