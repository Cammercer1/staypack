import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton({
  withAction = false,
}: {
  withAction?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6 border-b border-border/60 pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {withAction ? <Skeleton className="h-11 w-32 shrink-0 rounded-xl" /> : null}
    </div>
  );
}
