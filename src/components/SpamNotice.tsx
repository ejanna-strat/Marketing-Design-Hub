import { MailWarningIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Our emails come from a non-Stratpoint address for now, so they can land in
// spam (owner request, Oct 17). Remove once email moves to a Stratpoint domain.
export const EMAIL_SENDER = "marketingdesignhub@ejoo.site";

export function SpamNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm leading-relaxed text-amber-950",
        className,
      )}
    >
      <MailWarningIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <p>
        <span className="font-semibold">Check your spam folder.</span> Our emails come from{" "}
        <span className="font-medium break-all">{EMAIL_SENDER}</span>. If you don&apos;t see them in your inbox,
        look in Spam or Junk and mark them as &ldquo;Not spam&rdquo;.
      </p>
    </div>
  );
}
