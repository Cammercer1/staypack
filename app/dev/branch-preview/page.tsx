import { notFound } from "next/navigation";
import { LintRegressionPlayground } from "@/components/dev/LintRegressionPlayground";

export const metadata = { title: "Private branch preview", robots: { index: false, follow: false } };

export default function BranchPreviewPage() {
  if (process.env.STAYPACK_BRANCH_PREVIEW !== "1") notFound();
  return <LintRegressionPlayground branchPreview />;
}
