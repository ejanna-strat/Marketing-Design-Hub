// Copies config/team.ts into the database (team_members + designers) and
// re-applies roles to anyone who has already signed in.
// Run with: npm run seed:team

import { createClient } from "@supabase/supabase-js";
import { team } from "../config/team.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
}

const members = team.map((m) => ({ ...m, email: m.email.trim().toLowerCase() }));
for (const m of members) {
  if (!/^[^@\s]+@stratpoint\.com$/.test(m.email)) throw new Error(`Not a @stratpoint.com email: ${m.email}`);
  if (m.roles.includes("designer") && !m.designerName) throw new Error(`Designer ${m.email} needs a designerName`);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function run(label: string, query: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
}

const emails = members.map((m) => m.email);
const designers = members.filter((m) => m.roles.includes("designer"));

await run(
  "save roster",
  db.from("team_members").upsert(
    members.map((m) => ({
      email: m.email,
      full_name: m.fullName,
      roles: m.roles,
      designer_display_name: m.designerName ?? null,
    })),
  ),
);
await run(
  "remove people no longer on the roster",
  db.from("team_members").delete().not("email", "in", `(${emails.map((e) => `"${e}"`).join(",")})`),
);
await run(
  "save designers",
  db.from("designers").upsert(
    designers.map((m) => ({ email: m.email, display_name: m.designerName!, active: true })),
    { onConflict: "email" },
  ),
);
// Former designers are hidden, not deleted, so old requests keep their name.
await run(
  "hide former designers",
  db
    .from("designers")
    .update({ active: false })
    .not("email", "in", `(${designers.map((m) => `"${m.email}"`).join(",")})`),
);
await run("apply roles to signed-in users", db.rpc("sync_team_roster"));

console.log(`Roster saved: ${members.length} people, ${designers.length} designers.`);
