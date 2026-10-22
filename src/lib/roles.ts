import type { Enums } from "@/lib/supabase/database.types";

export type MemberRole = Exclude<Enums<"app_role">, "requester">;

// The tags a Marketing team member can have (Settings → Members).
// Anyone not on the team is a Requester.
export const MEMBER_ROLES: { value: MemberRole; label: string; description: string }[] = [
  {
    value: "lead_designer",
    label: "Lead Designer",
    description:
      "Reviews new requests, approves or returns them, assigns designers and manages members. Gets new-request emails and can be assigned requests.",
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
      "Sees everything and manages members. Works on requests like a Designer, but can't accept, assign or return new requests.",
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
