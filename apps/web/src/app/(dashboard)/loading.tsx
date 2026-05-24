import { Skeleton } from "@dc-copilot/ui/components/skeleton";

const METRIC_SKELETONS = ["metric-1", "metric-2", "metric-3", "metric-4"];
const CARD_SKELETONS = ["card-1", "card-2", "card-3"];

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRIC_SKELETONS.map((id) => (
          <Skeleton key={id} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CARD_SKELETONS.map((id) => (
            <Skeleton key={id} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
