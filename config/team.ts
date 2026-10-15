// The Marketing team roster. Everyone listed here gets their roles the first
// time they sign in; anyone else at Stratpoint becomes a Requester.
//
// After editing this file, run:  npm run seed:team
//
// TODO(owner): confirm the real email addresses for Steve, Sofia and Riann.
// Use each person's main @stratpoint.com address, not an alias.

export type Role = "admin" | "designer";

export type TeamMember = {
  email: string;
  fullName: string;
  roles: Role[];
  // The name shown in the Designer dropdown. Required for designers.
  designerName?: string;
  // Also gets the Marketing-team emails that go to "all designers + Riann"
  // (e.g. N1 New Design Request). Designers get them anyway.
  getsTeamEmails?: boolean;
};

export const team: TeamMember[] = [
  {
    email: "jerome.casupanan@stratpoint.com",
    fullName: "Jerome Casupanan Ko",
    roles: ["admin", "designer"],
    designerName: "Jerome",
  },
  {
    email: "steve@stratpoint.com", // placeholder
    fullName: "Steve",
    roles: ["admin", "designer"],
    designerName: "Steve",
  },
  {
    email: "sofia@stratpoint.com", // placeholder
    fullName: "Sofia",
    roles: ["designer"],
    designerName: "Sofia",
  },
  {
    email: "riann@stratpoint.com", // placeholder
    fullName: "Riann",
    roles: ["admin"],
    getsTeamEmails: true,
  },
  {
    // The project owner's account, so admin screens can be tested.
    email: "marketing-ai@stratpoint.com",
    fullName: "Stratpoint Marketing",
    roles: ["admin"],
  },
];
