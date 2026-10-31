/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as lists from "../lists.js";
import type * as maintenance from "../maintenance.js";
import type * as posts from "../posts.js";
import type * as preferences from "../preferences.js";
import type * as records from "../records.js";
import type * as roles from "../roles.js";
import type * as savedSearches from "../savedSearches.js";
import type * as seed from "../seed.js";
import type * as site from "../site.js";
import type * as storage from "../storage.js";
import type * as tags from "../tags.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  authz: typeof authz;
  history: typeof history;
  http: typeof http;
  lists: typeof lists;
  maintenance: typeof maintenance;
  posts: typeof posts;
  preferences: typeof preferences;
  records: typeof records;
  roles: typeof roles;
  savedSearches: typeof savedSearches;
  seed: typeof seed;
  site: typeof site;
  storage: typeof storage;
  tags: typeof tags;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
