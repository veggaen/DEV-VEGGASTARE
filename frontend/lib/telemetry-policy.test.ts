/** @fileOverview Optional telemetry privacy regressions. @stability stable */
import { describe, expect, it } from "vitest";
import { allowsAnalytics, sanitizeTelemetryUrl } from "./telemetry-policy";

describe("telemetry consent", () => {
  it.each([null, "broken", "{}", '{"version":1,"analytics":false}', '{"version":2,"analytics":true}', '{"version":1,"analytics":"true"}'])("fails closed for %s", raw => {
    expect(allowsAnalytics(raw)).toBe(false);
  });
  it("accepts explicit current consent", () => {
    expect(allowsAnalytics('{"version":1,"analytics":true}')).toBe(true);
  });
});

describe("telemetry URLs", () => {
  it("removes query tokens and fragments", () => {
    expect(sanitizeTelemetryUrl("https://www.veggat.com/auth/login?code=secret#token"))
      .toBe("https://www.veggat.com/auth/login");
  });
  it("removes private conversation identifiers", () => {
    expect(sanitizeTelemetryUrl("https://www.veggat.com/conversations/private-id"))
      .toBe("https://www.veggat.com/conversations/[id]");
  });
  it.each(["invalid", "javascript:alert(1)"])("rejects %s", url => {
    expect(sanitizeTelemetryUrl(url)).toBeNull();
  });
});
