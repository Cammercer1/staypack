"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { ReportTemplatePicker } from "@/components/reports/ReportTemplatePicker";
import { Button } from "@/components/ui/button";
import { getReportTemplate } from "@/lib/reports/templates/registry";
import { normalizeReportTemplateId } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  reportId: string;
  propertyAddress: string | null;
  baseReport: FinalReportJson;
};

const CLASSIC_SOURCE_FILES = [
  "lib/reports/templates/classic/index.tsx",
  "lib/reports/templates/classic/LightTemplate.tsx",
  "lib/reports/templates/classic/DetailedTemplate.tsx",
  "lib/reports/templates/classic/PageOne.tsx",
  "lib/reports/templates/classic/PageTwo.tsx",
  "lib/reports/templates/classic/ClassicHeroGallery.tsx",
  "lib/reports/templates/classic/ClassicPropertySection.tsx",
  "lib/reports/templates/classic/ClassicAgentFooter.tsx",
  "lib/reports/templates/classic/copyLimits.ts",
  "lib/reports/templates/registry.ts",
  "lib/reports/templates/ids.ts",
];

export function TemplatePlayground({
  reportId,
  propertyAddress,
  baseReport,
}: Props) {
  const [templateId, setTemplateId] = useState(() =>
    normalizeReportTemplateId(baseReport.template_id),
  );

  const previewReport = useMemo(
    () => ({ ...baseReport, template_id: templateId }),
    [baseReport, templateId],
  );

  const template = getReportTemplate(templateId);
  const sourceFiles =
    template.family === "classic"
      ? CLASSIC_SOURCE_FILES
      : [`lib/reports/templates/${template.family}`, "lib/reports/templates/registry.ts"];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b bg-background lg:w-96 lg:border-b-0 lg:border-r">
        <div className="space-y-6 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dev only
            </p>
            <h1 className="mt-1 font-display text-2xl tracking-tight">
              Template playground
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit template components in{" "}
              <code className="text-xs">lib/reports/templates/</code> and save —
              this preview hot-reloads. Use a report with a{" "}
              <strong>detailed STR estimate</strong> to fill page 2 data.
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium">{propertyAddress ?? "Untitled report"}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {reportId}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Template variant</p>
            <ReportTemplatePicker value={templateId} onChange={setTemplateId} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/reports/${reportId}`}>
              <Button variant="outline" size="sm">
                Open report editor
              </Button>
            </Link>
            <Link href="/dev/sales-brochures">
              <Button variant="outline" size="sm">
                Sales brochures
              </Button>
            </Link>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">How to build templates here</p>
            <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
              <li>
                Pick <strong>Classic — Light</strong> or <strong>Classic — Detailed</strong> above.
              </li>
              <li>
                Edit the files listed below — layout lives in{" "}
                <code>PageOne.tsx</code> / <code>PageTwo.tsx</code>, shared pieces in{" "}
                <code>Classic*.tsx</code>.
              </li>
              <li>
                Register new variants in <code>registry.ts</code> and{" "}
                <code>ids.ts</code>.
              </li>
              <li>
                Set copy limits per variant in <code>copyLimits.ts</code>.
              </li>
              <li>
                Compare with the report editor preview before publishing.
              </li>
            </ol>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">
              {template.label} · {template.pages} page{template.pages === 1 ? "" : "s"}
            </p>
            <ul className="max-h-48 space-y-1 overflow-auto font-mono text-xs text-muted-foreground">
              {sourceFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            URL: <code>/dev/templates?reportId={"{"}uuid{"}"}</code>
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-auto bg-muted/40 p-6 lg:p-10">
        <FittedReportPreview
          report={previewReport}
          maxHeight="none"
          className="mx-auto w-full max-w-[920px] border-0 bg-transparent shadow-none"
        />
      </main>
    </div>
  );
}
