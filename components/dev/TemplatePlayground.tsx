"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { ReportTemplatePicker } from "@/components/reports/ReportTemplatePicker";
import { Button } from "@/components/ui/button";
import { REPORT_TEMPLATES } from "@/lib/reports/templates/registry";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  reportId: string;
  propertyAddress: string | null;
  baseReport: FinalReportJson;
};

const TEMPLATE_SOURCE_PATHS: Record<string, string> = {
  classic: "lib/reports/templates/classic",
};

export function TemplatePlayground({
  reportId,
  propertyAddress,
  baseReport,
}: Props) {
  const [templateId, setTemplateId] = useState(
    baseReport.template_id || "classic",
  );
  const [printMode, setPrintMode] = useState(false);

  const previewReport = useMemo(
    () => ({ ...baseReport, template_id: templateId }),
    [baseReport, templateId],
  );

  const template = REPORT_TEMPLATES.find((entry) => entry.id === templateId);
  const sourcePath =
    TEMPLATE_SOURCE_PATHS[templateId] ?? `lib/reports/templates/${templateId}`;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b bg-background lg:w-80 lg:border-b-0 lg:border-r">
        <div className="space-y-6 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dev only
            </p>
            <h1 className="mt-1 font-display text-2xl tracking-tight">
              Template playground
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit template components and see changes here instantly. Content
              comes from your report fixture.
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium">{propertyAddress ?? "Untitled report"}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {reportId}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Template</p>
            <ReportTemplatePicker value={templateId} onChange={setTemplateId} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={printMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPrintMode((current) => !current)}
            >
              {printMode ? "Print mode on" : "Print mode off"}
            </Button>
            <Link href={`/reports/${reportId}`}>
              <Button variant="outline" size="sm">
                Open report editor
              </Button>
            </Link>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Editing {template?.label ?? templateId}</p>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground">
              <li>{sourcePath}/index.tsx</li>
              <li>{sourcePath}/PageOne.tsx</li>
              <li>{sourcePath}/ClassicHeroGallery.tsx</li>
              <li>{sourcePath}/ClassicPropertySection.tsx</li>
              <li>{sourcePath}/ClassicAgentFooter.tsx</li>
              <li>lib/reports/templates/registry.ts</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Add a new folder under <code>lib/reports/templates/</code>, register
              it in <code>registry.ts</code> and <code>ids.ts</code>, then pick it
              above.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-muted/40 p-6 lg:p-10">
        <ReportPreview report={previewReport} printMode={printMode} />
      </main>
    </div>
  );
}
