import { StrCalculatorWidget } from "@/components/str-calculator/StrCalculatorWidget";
import { loadPublicCalculator } from "@/lib/str-calculator/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "STR revenue calculator", robots: { index: false, follow: false } };

export default async function EmbedCalculatorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const calculator = await loadPublicCalculator(token);
  if (!calculator) return <main data-theme="staypack-workspace" className="min-h-dvh bg-base-100 p-8 text-base-content"><h1 className="text-xl font-semibold">Calculator unavailable</h1><p className="mt-3 text-sm leading-6">This calculator is currently paused or no longer available. Please contact the agency directly.</p></main>;
  return <main className="min-h-dvh"><StrCalculatorWidget brand={calculator.brand} country={calculator.widget.country} askPhone={calculator.widget.ask_phone} token={token} /></main>;
}
