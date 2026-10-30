import "server-only";
import { headers } from "next/headers";

// The address the app is being served from (localhost, a Vercel preview, or
// production), so login links and email buttons point back to the same site.
// Falls back to NEXT_PUBLIC_APP_URL outside a request.
export async function getAppUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not inside a request.
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Only allow redirects to paths on this site.
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
