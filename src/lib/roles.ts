import type { Enums } from "@/lib/supabase/database.types";

export type MemberRole = Exclude<Enums<"app_role">, "requester">;

// The tags a Marketing team member can have (Settings → Members).
// Anyone not on the team is a Requester.
export const MEMBER_ROLES: { value: MemberRole; label: string; description: string }[] = [
  {
    value: "lead_designer",
    label: "Lead Designer",
    description:
      "Reviews new requests, approves or returns them, assigns designers and manages members. Gets the new-request, reminder and deadline emails and can be assigned requests.",
  },
  {
    value: "designer",
    label: "Designer",
    description: "Handles assigned requests: updates the status, adds the output link and marks requests completed.",
  },
  {
    value: "admin",
    label: "Admin",
    description:
      "Sees everything and manages members. Edits request details and the output link, and can put a request on hold or cancel it.",
  },
  {
    value: "super_admin",
    label: "Super Admin",
    description:
      "Full access: reviews new requests (Accept & assign, Return), assigns and removes designers, manages members and gives the Super Admin tag.",
  },
];

export function roleLabel(role: string) {
  return MEMBER_ROLES.find((r) => r.value === role)?.label ?? role;
}
