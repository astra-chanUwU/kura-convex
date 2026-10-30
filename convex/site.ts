import { v } from "convex/values";
import { query } from "./_generated/server";

export const status = query({
  args: {},
  returns: v.object({
    name: v.string(),
    ok: v.boolean(),
  }),
  handler: async () => {
    return {
      name: "Kura Convex",
      ok: true,
    };
  },
});
