
/**
* An array of routes that are accessible to the public,
* This is here because by default every route might be protected?
* Public routes that don't require authentication
* @type {string[]}
*/
export const publicRoutes = [
  "/",
  "/products", // ✅ NEW — allow listing
  "/pulse", // ✅ Public Pulse page (anyone can view, only logged-in can post)
  "/info",
  "/privacy", // ✅ Privacy page is public
  "/terms", // ✅ Sales terms page (required for Vipps)
  "/contact",
  "/auth/new-verification",
  "/api/bring-shipping",
  "/api/bring-shipping-suggest-postcode",
  // Note: Employee routes removed - they have internal auth checks
  "/api/edgestore/request-upload",
  "/api/edgestore/confirm-upload"
];

/**
* An array of routes that are used for authentication
* Auth routes (redirect logged-in users away)
* @type {string[]}
*/
export const authRoutes = [
  "/auth/login",
  "/auth/register",
  "/auth/error",
  "/auth/reset",
  "/auth/new-password"
];

/**
* The prefix for API authentication routes
* Routes that start with this prefix are used for API authentication purposes
* @type {string}
*/
export const apiAuthPrefix = [
    "/api/auth",
    
];

/**
* The default redirect path afther logging in
* @type {string}
*/
export const DEFAULT_LOGIN_REDIRECT = "/nexus";