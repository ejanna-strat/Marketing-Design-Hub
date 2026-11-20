import { redirect } from "next/navigation";

// Moved to the Marketing Support Hub Settings (owner, Nov 20).
export default function OldMembersLink() {
  redirect("/settings/members");
}
