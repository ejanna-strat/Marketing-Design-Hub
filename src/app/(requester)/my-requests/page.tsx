import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { ViewSwitch } from "@/components/data-table/ViewSwitch";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listRequests, parseListParams } from "@/lib/requests/list";
import { statusOptions } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { MyRequestsTable } from "./MyRequestsTable";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();

  const [{ rows, total }, types] = await Promise.all([
    listRequests(supabase, params, { requesterId: user.id, scope: "requester" }),
    supabase.from("request_types").select("id, name").order("sort_order"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">My Design Requests</h1>
          <p className="text-muted-foreground">Track the status of the requests you filed.</p>
        </div>
        <Button asChild>
          <Link href="/requests/new">
            <PlusIcon />
            New Design Request
          </Link>
        </Button>
      </div>
      <DataTableToolbar
        leading={<ViewSwitch requester />}
        filters={[
          { key: "status", label: "Status", options: statusOptions("requester") },
          { key: "type", label: "Type", options: (types.data ?? []).map((t) => ({ value: t.id, label: t.name })) },
        ]}
      />
      <MyRequestsTable rows={rows} total={total} page={params.page} pageSize={params.pageSize} />
    </div>
  );
}
