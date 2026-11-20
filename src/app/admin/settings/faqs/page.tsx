import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FaqsManager } from "./FaqsManager";

export default async function FaqsPage() {
  // Super Admins and Lead Designers only.
  const user = await requireStaff();
  if (!user.isManager) redirect(user.canOpenSettings ? "/settings" : "/admin/pipeline");
  const supabase = await createClient();

  const { data: faqs, error } = await supabase.from("faqs").select("id, question, answer, visible").order("position");
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Hub settings</p>
        <h1 className="text-2xl font-bold">Requester FAQs</h1>
        <p className="max-w-2xl text-muted-foreground">
          The Frequently Asked Questions on the home page, for everyone who files requests. Changes show on the home
          page right away. Hidden questions stay here but don&apos;t show on the home page.
        </p>
      </div>
      <FaqsManager faqs={faqs ?? []} />
    </div>
  );
}
