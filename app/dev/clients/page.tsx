import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { ClientSetupPreview } from "@/components/dev/ClientSetupPreview";
export const dynamic = "force-dynamic";
export default async function ClientPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  if ((await searchParams).view === "mobile") return <main className="p-4"><iframe title="Mobile client picker preview" src="/dev/clients" width="320" height="900" className="max-w-full border-0" /></main>;
  return <AppShell><ClientSetupPreview /></AppShell>;
}
