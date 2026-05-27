import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  highlight?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  highlight,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 border-b border-border/60 pb-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl space-y-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="heading-gradient font-display text-4xl tracking-tight md:text-5xl">
          {highlight ? (
            <>
              <span className="italic">{highlight}</span> {title}
            </>
          ) : (
            title
          )}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
