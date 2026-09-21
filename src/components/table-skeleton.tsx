// ============================================================
// TableSkeleton - Loading placeholder for tables
// ============================================================
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 6, className }: TableSkeletonProps) {
  return (
    <div className={cn("space-y-3 py-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className={cn(
                "h-4 animate-pulse rounded bg-muted",
                j === columns - 1 ? "ml-auto w-16" : "flex-1"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
