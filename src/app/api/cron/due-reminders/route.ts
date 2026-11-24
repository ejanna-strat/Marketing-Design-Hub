import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { sendDueReminders, sendOnHoldReminders, sendUnassignedReminders } from "@/lib/email/notifications";

// Called by Vercel Cron (vercel.json) every weekday at 8AM Manila: the 3-day
// deadline reminder, the new-request (no designer) reminder and the 30-day
// On hold reminder (Nov 24). Vercel
// sends "Authorization: Bearer <CRON_SECRET>", so nobody else can trigger it.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = await getAppUrl();
  const [due, unassigned, onHold] = await Promise.all([
    sendDueReminders(appUrl),
    sendUnassignedReminders(appUrl),
    sendOnHoldReminders(appUrl),
  ]);
  return NextResponse.json({ ok: true, sent: due, unassigned, onHold });
}
