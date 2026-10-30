export const accountRoles = ["owner", "moderator", "curator", "contributor", "member"] as const;

export type AccountRole = (typeof accountRoles)[number];

// Local board accounts. Missing emails, including new sign-ups, are members.
export const seedAccountRoles: Record<string, AccountRole> = {
  "hana@kura.test": "owner",
  "ren@kura.test": "moderator",
  "sable@kura.test": "curator",
  "mio@kura.test": "contributor",
  "yuna@kura.test": "contributor",
  "akira@kura.test": "contributor",
  "noel@kura.test": "contributor",
  "camille@kura.test": "contributor",
  "jules@kura.test": "member",
  "priya@kura.test": "member",
  "leo@kura.test": "member",
  "eden@kura.test": "member",
};

export function roleForEmail(email: string): AccountRole {
  return seedAccountRoles[email.trim().toLowerCase()] ?? "member";
}

export function canUpload(role: AccountRole | null | undefined) {
  return role === "contributor" || role === "moderator" || role === "owner";
}

export function canModerate(role: AccountRole | null | undefined) {
  return role === "moderator" || role === "owner";
}

export function roleLabel(role: AccountRole | null | undefined) {
  switch (role) {
    case "owner":
      return "Owner";
    case "moderator":
      return "Moderator";
    case "curator":
      return "Curator";
    case "contributor":
      return "Contributor";
    default:
      return "Member";
  }
}
