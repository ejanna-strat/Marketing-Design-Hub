import { AppHeader } from "@/components/shell/AppHeader";
import { requireUser } from "@/lib/auth";

export default async function RequesterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader user={user} />
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
