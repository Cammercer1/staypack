export function ReportDisclaimer({
  text,
  short = false,
}: {
  text: string;
  short?: boolean;
}) {
  return (
    <p className={short ? "text-xs leading-5 text-muted-foreground" : "text-sm leading-6 text-muted-foreground"}>
      {text}
    </p>
  );
}
