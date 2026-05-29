import { PageHeaderSkeleton } from "@/components/app-shell/PageHeaderSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-72 rounded-lg" />
          <Skeleton className="h-9 w-64 rounded-xl" />
        </div>
        <div className="surface-card divide-y divide-border/60 overflow-hidden p-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="size-4 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-3 w-20 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
