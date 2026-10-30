const minPasswordLen = 15;
const maxPasswordLen = 128;

const commonPasswords = new Set([
  "123456", "123456789", "12345678", "12345", "1234567",
  "1234567890", "123456789012345", "0123456789", "111111",
  "password", "password1", "password123", "password1234",
  "password12345", "password123456", "passw0rd", "p@ssw0rd",
  "qwerty", "qwerty123", "qwertyuiop", "qwertyqwerty",
  "abc123", "abcd1234", "letmein", "letmein123",
  "admin", "administrator", "welcome", "welcome123",
  "login", "user", "guest", "default", "changeme",
  "iloveyou", "iloveyou1", "iloveyou123", "iloveyouiloveyou",
  "monkey", "dragon", "football", "baseball",
  "sunshine", "princess", "superman", "batman",
  "trustno1", "master", "shadow", "michael",
  "charlie", "thomas", "jordan", "hunter",
  "computer", "internet", "secret", "summer",
  "winter", "spring", "autumn", "hello123",
  "freedom", "whatever", "nicole", "jessica",
  "andrew", "joshua", "daniel", "matthew",
  "pokemon", "naruto", "lol12345", "123qwe",
  "qwe123", "zxcvbn", "zxcvbnm", "asdfgh",
  "asdfghjkl", "1qaz2wsx", "1q2w3e4r", "1q2w3e",
  "q1w2e3r4", "aa123456", "a123456", "abc1234",
  "abcd12345", "stars", "flower", "happy123",
  "london", "paris123", "soccer", "hockey",
  "killer", "george", "pepper", "ginger",
  "love1234", "lovely", "sweetie", "diamond",
  "golden", "silver", "bronze", "purple",
  "orange123", "banana", "strawberry", "chocolate",
  "correcthorsebatterystaple",
]);

export function passwordProblem(username: string, password: string) {
  if (password.length < minPasswordLen || password.length > maxPasswordLen) {
    return "Passwords need 15–128 characters — a short sentence you can remember makes a great one.";
  }
  const lower = password.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) {
    return "That password contains your username — pick something less guessable.";
  }
  if (commonPasswords.has(lower)) {
    return "That password is on lists of commonly used passwords — pick a less guessable one.";
  }
  const first = password[0];
  if (first && [...password].every((char) => char === first)) {
    return "That password is a single repeated character — pick a less guessable one.";
  }
  return null;
}
