import { Badge } from "@/components/ui/badge";
import { windowLabel, type WindowStatus } from "./triggerModel";

/** Day count + write-window state, e.g. "Day 33 · Write". Black/white only. */
export const WindowChip = ({
  windowStatus,
  dayCount,
}: {
  windowStatus: WindowStatus;
  dayCount: number | null | undefined;
}) => {
  const urgent = windowStatus === "expiring" || windowStatus === "expired";
  return (
    <Badge
      variant={urgent ? "default" : "outline"}
      className="whitespace-nowrap font-normal"
    >
      {dayCount != null ? `Day ${dayCount} · ` : ""}
      {windowLabel(windowStatus)}
    </Badge>
  );
};
