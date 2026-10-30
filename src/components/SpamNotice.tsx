import { MailWarningIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Our emails come from a non-Stratpoint address for now, so they can land in
// spam (owner request, Oct 17). Remove once email moves to a Stratpoint domain.
export const EMAIL_SENDER = "marketingcreativehub@ejoo.site";
export const EMAIL_SENDER_NAME = "Marketing Creative Hub";

// `senderOnOwnLine`: in narrow boxes (sign in / sign up) the sender name and
// email go on their own line, so there's no big gap before the email
// (owner, Oct 22).
export function SpamNotice({ className, senderOnOwnLine = false }: { className?: string; senderOnOwnLine?: boolean }) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-left text-sm leading-relaxed text-amber-950 dark:text-amber-300",
        className,
      )}
    >
      <MailWarningIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <p>
        <span className="font-semibold">Check your spam folder.</span> Our emails will appear under the sender name{" "}
        <span className={cn("font-medium", senderOnOwnLine && "sm:block")}>
          {EMAIL_SENDER_NAME} (<span className="whitespace-nowrap">{EMAIL_SENDER}</span>).
        </span>{" "}
        {/* The second sentence starts on its own line on wider screens (owner, Oct 21). */}
        <span className="sm:block">
          If you don&apos;t see them in your inbox, check your Spam or Junk folder and mark the email as &ldquo;Not
          spam.&rdquo;
        </span>
      </p>
    </div>
  );
}
