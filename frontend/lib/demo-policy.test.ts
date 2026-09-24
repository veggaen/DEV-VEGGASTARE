/** @fileOverview Regression coverage for public demo write isolation. @stability stable */
import { describe, expect, it } from "vitest";
import { allowsDemoMutation, isDemoUserId } from "./demo-policy";
describe("demo isolation", () => {
  it("identifies only server-provisioned demo IDs", () => {
    expect(isDemoUserId("demo_2026-09-23_random")).toBe(true);
    expect(isDemoUserId("regular-user")).toBe(false);
    expect(isDemoUserId(undefined)).toBe(false);
  });
  it.each(["/api/returns/return-id", "/api/returns/return-id/acknowledgment", "/api/ai-chat/sessions/cfake/trigger-ai", "/api/ai-chat/sessions/cfake", "/api/orders", "/api/payments", "/api/payments/capture", "/api/users", "/settings", "/api/users/ai-keys", "/api/auth/callback/google", "/api/admin/impersonate", "/api/edgestore/request-upload", "/api/edgestore/delete-file", "/api/edgestore/init/upload"])("blocks demo mutations at %s", path => {
    expect(allowsDemoMutation(path)).toBe(false);
  });
  it.each(["/api/returns", "/api/ai-chat", "/api/ai-chat/sessions", "/api/ai-chat/sessions/cfake/messages", "/api/ai-chat/sessions/cfake/title", "/api/cart/user", "/api/auth/signout", "/api/edgestore/init"])("permits scoped demo interaction at %s", path => {
    expect(allowsDemoMutation(path)).toBe(true);
  });
});
