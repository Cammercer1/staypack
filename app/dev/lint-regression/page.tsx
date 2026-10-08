import { notFound } from "next/navigation";
import { LintRegressionPlayground } from "@/components/dev/LintRegressionPlayground";

export const metadata = { title: "Mock regression preview", robots: { index: false, follow: false } };

export default function LintRegressionPage() {
  if (process.env.NODE_ENV !== "development" && process.env.STAYPACK_REGRESSION_PREVIEW !== "1") notFound();
  return <LintRegressionPlayground />;
}
