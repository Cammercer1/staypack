const bodyFont = "var(--report-body-font, inherit)";
const headingFont = "var(--report-heading-font, inherit)";

type Props = {
  comparableEvidence: string;
  comparableDisclaimer?: string;
};

export function HavenLeaseComparableEvidence({
  comparableEvidence,
  comparableDisclaimer,
}: Props) {
  const paragraphs = comparableEvidence.split(/\n\n+/).filter(Boolean);

  if (!paragraphs.length) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <h3
        className="text-[0.72rem] font-semibold text-neutral-900"
        style={{ fontFamily: headingFont }}
      >
        Comparable rental evidence
      </h3>
      <div className="space-y-2">
        {paragraphs.map((para) => (
          <p
            key={para.slice(0, 48)}
            className="text-[0.68rem] leading-[1.65] text-neutral-600"
            style={{ fontFamily: bodyFont }}
          >
            {para.trim()}
          </p>
        ))}
      </div>
      {comparableDisclaimer ? (
        <p
          className="pt-1 text-[0.56rem] leading-relaxed text-neutral-400"
          style={{ fontFamily: bodyFont }}
        >
          {comparableDisclaimer}
        </p>
      ) : null}
    </div>
  );
}
