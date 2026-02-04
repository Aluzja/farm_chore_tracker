/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessKeys from "../accessKeys.js";
import type * as auth from "../auth.js";
import type * as authCheck from "../authCheck.js";
import type * as chores from "../chores.js";
import type * as dailyChores from "../dailyChores.js";
import type * as http from "../http.js";
import type * as masterChores from "../masterChores.js";
import type * as photos from "../photos.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessKeys: typeof accessKeys;
  auth: typeof auth;
  authCheck: typeof authCheck;
  chores: typeof chores;
  dailyChores: typeof dailyChores;
  http: typeof http;
  masterChores: typeof masterChores;
  photos: typeof photos;
  tasks: typeof tasks;
  users: typeof users;
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

export declare const components: {};
