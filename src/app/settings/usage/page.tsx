import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Settings → Usage (owner, Nov 24): how much of the Supabase plan the app
// uses, for everyone on the Marketing team, so they see what the owner sees
// before an upgrade. Numbers come from app_usage() (0045), checked each time
// the page opens.

// Supabase Free plan limits (the live project is on Free, owner Nov 24).
const PLAN = "Free";
const LIMITS = { db: 500 * 1024 ** 2, files: 1024 ** 3 };
const WARN_AT = 80;

// Plain names for the biggest tables.
const TABLE_LABELS: Record<string, string> = {
  activity_log: "Activity history",
  requests: "Requests",
  request_answers: "Request form answers",
  notifications_log: "Email log",
  request_designers: "Request designers",
  feedback: "Feedback",
  profiles: "Accounts",
  announcements: "Announcements",
  form_questions: "Form questions",
  team_members: "Team members",
  faqs: "Requester FAQs",
  user_roles: "Account roles",
  designers: "Designers",
  teams: "Business units",
  request_types: "Request types",
};

type Usage = {
  db_bytes: number;
  file_bytes: number;
  file_count: number;
  tables: { name: string; bytes: number }[];
};

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function percent(used: number, limit: number) {
  const p = (used / limit) * 100;
  return p > 0 && p < 1 ? "<1" : Math.round(p).toString();
}

export default async function UsagePage() {
  const user = await requireUser();
  if (!user.isStaff) redirect("/hubs");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_usage");
  if (error) throw new Error(error.message);
  const usage = data as unknown as Usage;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="max-w-2xl text-muted-foreground">
          How much of the app&apos;s storage is used, on the Supabase {PLAN} plan. Bars turn amber at {WARN_AT}% and red
          at 95%: that&apos;s the time to clean up or upgrade the plan. Checked{" "}
          {formatDateTime(new Date().toISOString())}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Meter
          title="Database"
          note="Requests, members, feedback, announcements and their history"
          used={usage.db_bytes}
          limit={LIMITS.db}
        />
        <Meter
          title="File storage"
          note={`Uploaded files (${usage.file_count} ${usage.file_count === 1 ? "file" : "files"}). Designs are saved as links, not files.`}
          used={usage.file_bytes}
          limit={LIMITS.files}
        />
      </div>

      <section className="space-y-3 rounded-xl border bg-background p-5">
        <div className="space-y-1">
          <h2 className="font-semibold">What takes the most space in the database</h2>
          <p className="text-sm text-muted-foreground">
            The rest of the database size is Supabase&apos;s own setup (sign-ins, system tables).
          </p>
        </div>
        <ul className="divide-y">
          {usage.tables.map((t) => (
            <li key={t.name} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span>{TABLE_LABELS[t.name] ?? t.name}</span>
              <span className="font-medium tabular-nums">{size(t.bytes)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Meter({ title, note, used, limit }: { title: string; note: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const level = pct >= 95 ? "red" : pct >= WARN_AT ? "amber" : "ok";
  return (
    <section className="space-y-3 rounded-xl border bg-background p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            level === "red" ? "text-red-600" : level === "amber" ? "text-amber-700 dark:text-amber-400" : "text-brand",
          )}
        >
          {percent(used, limit)}% used
        </p>
      </div>
      <div
        role="meter"
        aria-label={`${title} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-3 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full",
            level === "red" ? "bg-red-500" : level === "amber" ? "bg-amber-500" : "bg-brand",
          )}
          style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }}
        />
      </div>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{size(used)}</span>
        <span className="text-muted-foreground"> of {size(limit)}</span>
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </section>
  );
}
