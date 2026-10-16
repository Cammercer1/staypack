import type { FinalReportJson } from "@/lib/types";

/** Render only a frozen public name. Legacy reports without this field keep their original layout. */
export function ReportPreparedFor({ report, className = "mt-2 text-[0.75rem] leading-snug" }: {
  report?: Pick<FinalReportJson, "recipient">;
  className?: string;
}) {
  const name = report?.recipient?.displayName;
  if (!name) return null;
  return <p className={className} data-report-recipient style={{ fontFamily: "var(--report-body-font, inherit)", overflowWrap: "anywhere" }}>Prepared for {name}</p>;
}
