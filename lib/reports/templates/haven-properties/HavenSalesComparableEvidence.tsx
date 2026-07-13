import {
  ReportCopyComparableDisclaimer,
  ReportCopyComparableEvidence,
} from "@/components/reports/inline/ReportCopyFields";

const bodyFont = "var(--report-body-font, inherit)";
const headingFont = "var(--report-heading-font, inherit)";

type Props = {
  comparableEvidence: string;
  comparableDisclaimer?: string;
};

export function HavenSalesComparableEvidence({
  comparableEvidence,
  comparableDisclaimer,
}: Props) {
  if (!comparableEvidence.trim()) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <h3
        className="text-[0.72rem] font-semibold text-neutral-900"
        style={{ fontFamily: headingFont }}
      >
        Comparable sale evidence
      </h3>
      <div className="space-y-2">
        <ReportCopyComparableEvidence
          text={comparableEvidence}
          className="text-[0.68rem] leading-[1.65] text-neutral-600"
          style={{ fontFamily: bodyFont }}
        />
      </div>
      {comparableDisclaimer ? (
        <ReportCopyComparableDisclaimer
          text={comparableDisclaimer}
          as="p"
          className="pt-1 text-[0.56rem] leading-relaxed text-neutral-400"
          style={{ fontFamily: bodyFont }}
        />
      ) : null}
    </div>
  );
}
