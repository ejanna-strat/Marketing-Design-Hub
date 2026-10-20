import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { sendDueReminders } from "@/lib/email/notifications";

// Called by Vercel Cron (vercel.json) every weekday at 8AM Manila. Vercel
// sends "Authorization: Bearer <CRON_SECRET>", so nobody else can trigger it.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await sendDueReminders(await getAppUrl());
  return NextResponse.json({ ok: true, sent });
}
