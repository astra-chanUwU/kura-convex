const alphabet = "abcdefghijklmnopqrstuvwxyz234567";

export function generateRecoveryKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length] ?? "a");
  const groups: string[] = [];
  for (let index = 0; index < chars.length; index += 4) {
    groups.push(chars.slice(index, index + 4).join("").toUpperCase());
  }
  return groups.join("-");
}

export function normalizeRecoveryKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function recoveryKeyHash(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeRecoveryKey(key)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sameSecret(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
