// Older entry point. `pnpm seed` runs scripts/seed.mjs.
import { main } from "./seed.mjs";

main(process.argv.slice(2)).catch((error) => {
  if (error?.usage) console.error(error.message);
  else console.error(error);
  process.exit(1);
});
