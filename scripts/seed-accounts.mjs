import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// Local board members. Roles are the contract for account permissions.
// The password lives in .env.local as KURA_SEED_PASSWORD and is not printed.
const members = [
  { email: "hana@kura.test", name: "Hana Mori", role: "owner", focus: "mixed", saves: 24, saveTag: "", bio: "Keeps the board in order.", location: "Osaka", theme: "kura", showSensitive: true, include: [], exclude: [] },
  { email: "ren@kura.test", name: "Ren Aoki", role: "moderator", focus: "mixed", saves: 40, saveTag: "", bio: "Looks through new posts.", location: "Sapporo", theme: "danbooru", showSensitive: true, include: [], exclude: [] },
  { email: "sable@kura.test", name: "Sable Quinn", role: "curator", focus: "yuri", saves: 48, saveTag: "yuri", bio: "Collects quiet scenes.", location: "Montreal", theme: "catppuccin", showSensitive: false, include: ["yuri"], exclude: [] },
  { email: "mio@kura.test", name: "Mio Chen", role: "contributor", focus: "cyberpunk", saves: 8, saveTag: "cyberpunk", bio: "Night cities and neon.", location: "Taipei", theme: "kura", showSensitive: false, include: ["cyberpunk"], exclude: [] },
  { email: "yuna@kura.test", name: "Yuna Park", role: "contributor", focus: "cute", saves: 12, saveTag: "cute", bio: "Soft colors and small moments.", location: "Seoul", theme: "lambdadelta", showSensitive: false, include: ["cute"], exclude: [] },
  { email: "akira@kura.test", name: "Akira Sato", role: "contributor", focus: "yuri", saves: 10, saveTag: "yuri", bio: "Posts the pictures worth finding again.", location: "Kyoto", theme: "beatrice", showSensitive: false, include: ["yuri"], exclude: [] },
  { email: "noel@kura.test", name: "Noel Ibarra", role: "contributor", focus: "mixed", saves: 6, saveTag: "", bio: "Uploads when something sticks.", location: "Mexico City", theme: "umineko", showSensitive: false, include: [], exclude: [] },
  { email: "camille@kura.test", name: "Camille Ortiz", role: "contributor", focus: "cyberpunk", saves: 5, saveTag: "cyberpunk", bio: "Rain, glass, and signage.", location: "Barcelona", theme: "erika", showSensitive: false, include: ["cyberpunk"], exclude: [] },
  { email: "jules@kura.test", name: "Jules Hart", role: "member", focus: "none", saves: 30, saveTag: "cute", bio: "Here to look.", location: "Portland", theme: "kura", showSensitive: false, include: ["cute"], exclude: [] },
  { email: "priya@kura.test", name: "Priya Nair", role: "member", focus: "none", saves: 0, saveTag: "", bio: "Just arrived.", location: "Bengaluru", theme: "virgilia", showSensitive: false, include: [], exclude: [] },
  { email: "leo@kura.test", name: "Leo Berg", role: "member", focus: "none", saves: 4, saveTag: "yuri", bio: "Skips anything too loud.", location: "Berlin", theme: "catppuccin", showSensitive: false, include: [], exclude: ["cyberpunk"] },
  { email: "eden@kura.test", name: "Eden Cho", role: "member", focus: "cute", saves: 16, saveTag: "cute", bio: "Saves the ones worth opening again.", location: "Auckland", theme: "danbooru", showSensitive: true, include: ["cute"], exclude: [] },
];

const env = readEnv(".env.local");
const adminKey = env.CONVEX_SELF_HOSTED_ADMIN_KEY;
if (!adminKey) {
  console.error("CONVEX_SELF_HOSTED_ADMIN_KEY is missing from .env.local.");
  process.exit(1);
}
const password = ensurePassword(env);
const site = (env.VITE_CONVEX_SITE_URL ?? "http://127.0.0.1:3211").replace(/\/$/, "");
const convex = new ConvexHttpClient(env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210");
convex.setAdminAuth(adminKey);

const authors = [];
for (const member of members) {
  const userId = await accountId(member);
  const username = member.email.split("@")[0];
  await convex.mutation(anyApi.roles.ensureUsername, { email: member.email, username });
  console.log(`${member.role.padEnd(12)} ${member.email}`);
  await convex.mutation(anyApi.seed.saveProfile, {
    userId,
    displayName: member.name,
    bio: member.bio,
    location: member.location,
    website: "",
    theme: member.theme,
    font: "system",
    showSensitive: member.showSensitive,
    includeTags: member.include,
    excludeTags: member.exclude,
    ...(member.saveTag ? { saveTag: member.saveTag } : {}),
    saves: member.saves,
  });
  if (member.focus !== "none") authors.push({ userId, focus: member.focus });
}

let cursor = null;
let updated = 0;
for (;;) {
  const page = await convex.mutation(anyApi.seed.assignAuthors, { cursor, authors });
  updated += page.updated;
  if (page.isDone) break;
  cursor = page.cursor;
}
console.log(`Attributed ${updated} pictures.`);

async function accountId(member) {
  const username = member.email.split("@")[0];
  const created = await auth("/api/auth/sign-up/email", {
    name: member.name,
    email: member.email,
    password,
    username,
  });
  if (created.user?.id) return created.user.id;
  const signed = await auth("/api/auth/sign-in/email", { email: member.email, password });
  if (signed.user?.id) return signed.user.id;
  throw new Error(created.message || signed.message || `Could not open ${member.email}`);
}

async function auth(path, body) {
  const response = await fetch(`${site}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.VITE_SITE_URL ?? "http://127.0.0.1:5175",
    },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => ({}));
}

function ensurePassword(current) {
  if (current.KURA_SEED_PASSWORD) return current.KURA_SEED_PASSWORD;
  const password = "kura-local-board";
  let text = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  if (text && !text.endsWith("\n")) text += "\n";
  writeFileSync(".env.local", `${text}KURA_SEED_PASSWORD='${password}'\n`);
  return password;
}

function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)='?([^']*)'?$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}
