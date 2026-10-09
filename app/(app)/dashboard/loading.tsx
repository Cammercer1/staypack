import { PageHeaderSkeleton } from "@/components/app-shell/PageHeaderSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton withAction />
      <div className="surface-card space-y-5 p-6 md:p-8">
        <Skeleton className="h-6 w-44" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-52 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
