import { statusBadgeClass, statusLabel } from "@/lib/statuses";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  audience = "staff",
  className,
}: {
  status: string;
  audience?: "staff" | "requester";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusBadgeClass(status),
        className,
      )}
    >
      {statusLabel(status, audience)}
    </span>
  );
}
