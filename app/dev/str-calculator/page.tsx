import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { StrCalculatorWorkspace } from "@/components/str-calculator/StrCalculatorWorkspace";
import { calculatorBrand } from "@/lib/str-calculator/brand";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { StrCalculatorWidget } from "@/components/str-calculator/StrCalculatorWidget";

export const dynamic = "force-dynamic";
export default async function CalculatorPreview({ searchParams }: { searchParams: Promise<{ view?: string; phone?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { agency } = createLintRegressionFixtures();
  const { view, phone } = await searchParams;
  const askPhone = phone === "true";
  if (view === "widget") return <StrCalculatorWidget brand={calculatorBrand(agency)} country="AU" askPhone={askPhone} preview />;
  if (view === "mobile") return <main className="p-4"><p className="mb-4">320 px embed preview · sample result only</p><iframe title="Mobile calculator preview" src={`/dev/str-calculator?view=widget&phone=${askPhone}`} width="320" height="900" className="max-w-full border-0" /></main>;
  return <AppShell><p className="mb-6 text-sm">Development preview · sample agency and enquiries · live calculator controls are disabled.</p><StrCalculatorWorkspace brand={calculatorBrand(agency)} initialWidget={{ id: "preview", public_token: "00000000-0000-4000-8000-000000000000", enabled: false, country: "AU", ask_phone: askPhone }} canManage={false} leads={[{ id: "sample", address: "12 Example Street, Sydney NSW 2000", bedrooms: 3, email: "preview@example.com", phone: askPhone ? "0412 345 678" : null, country: "AU", status: "estimated", created_at: "2026-10-14T04:30:00Z", estimate_json: { annualRevenue: 62400, monthlyRevenue: 5200, nightlyRate: 260, occupancyRate: 65.8, currency: "AUD", address: "12 Example Street, Sydney NSW 2000", bedrooms: 3, bathrooms: 2, guests: 6 } }]} total={1} page={1} baseUrl="http://localhost:3000" loadedAt={0} /></AppShell>;
}
