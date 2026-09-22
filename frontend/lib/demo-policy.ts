/** @fileOverview Restrictions for isolated, non-paying demo identities. @stability experimental */
export const DEMO_ID_PREFIX = "demo_";
export function isDemoUserId(id: unknown): id is string {
  return typeof id === "string" && id.startsWith(DEMO_ID_PREFIX);
}

/** Demo visitors can explore their own cart, never publish or spend money.
 * AI is enabled only after the atomic demo grant and platform fuse ship in S5. */
export function allowsDemoMutation(path: string): boolean {
  return path === "/api/auth/signout" || path === "/api/auth/callback/demo" ||
    path === "/api/demo/checkout" ||
    // SDK session initialization is read-only. Upload/delete routes stay denied.
    path === "/api/edgestore/init" ||
    path === "/api/cart" || path.startsWith("/api/cart/");
}
