import { describe, expect, it } from "vitest";
import { detectImageIntent } from "./image-intent";

describe("detectImageIntent", () => {
  it("catches casual generation requests", () => {
    expect(detectImageIntent("generate an image of a misty fjord")?.prompt).toBe("generate an image of a misty fjord");
    expect(detectImageIntent("Can you make me a logo for a coffee brand?")).not.toBeNull();
    expect(detectImageIntent("draw a picture of a fox")).not.toBeNull();
    expect(detectImageIntent("please create an illustration of a lighthouse")).not.toBeNull();
  });
  it("supports the explicit command and strips it", () => {
    expect(detectImageIntent("/image a paper boat on a lake")?.prompt).toBe("a paper boat on a lake");
    expect(detectImageIntent("/imagine neon city at night")?.prompt).toBe("neon city at night");
  });
  it("leaves normal chat alone", () => {
    expect(detectImageIntent("what is the picture quality of this monitor?")).toBeNull();
    expect(detectImageIntent("explain how image compression works")).toBeNull();
    expect(detectImageIntent("make a list of pros and cons")).toBeNull();
    expect(detectImageIntent("")).toBeNull();
  });
});
