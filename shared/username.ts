const usernamePattern = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(raw: string) {
  const username = raw.trim().toLowerCase();
  if (!usernamePattern.test(username)) return null;
  return username;
}

export function accountEmail(username: string) {
  return `${username}@users.kura.test`;
}
