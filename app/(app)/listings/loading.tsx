import { PageHeaderSkeleton } from "@/components/app-shell/PageHeaderSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingsLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton withAction />
      <div className="surface-card divide-y divide-border/60 overflow-hidden p-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-14 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
