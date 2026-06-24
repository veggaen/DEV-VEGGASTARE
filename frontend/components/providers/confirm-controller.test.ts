import { describe, expect, it, vi } from "vitest";
import { createConfirmController } from "./confirm-controller";

const OPTS = { title: "Delete this?", confirmLabel: "Delete", destructive: true } as const;

describe("confirm controller", () => {
  it("opens and notifies onChange with the options", () => {
    const onChange = vi.fn();
    const c = createConfirmController(onChange);
    c.open(OPTS);
    expect(onChange).toHaveBeenCalledWith(true, OPTS);
    expect(c.isPending()).toBe(true);
  });

  it("resolves true when settled with true (confirm)", async () => {
    const onChange = vi.fn();
    const c = createConfirmController(onChange);
    const p = c.open(OPTS);
    c.settle(true);
    await expect(p).resolves.toBe(true);
    // closing notification fired
    expect(onChange).toHaveBeenLastCalledWith(false, null);
    expect(c.isPending()).toBe(false);
  });

  it("resolves false when settled with false (cancel / esc / overlay)", async () => {
    const c = createConfirmController(() => {});
    const p = c.open(OPTS);
    c.settle(false);
    await expect(p).resolves.toBe(false);
    expect(c.isPending()).toBe(false);
  });

  it("settle() before any open is a no-op (does not throw, does not notify)", () => {
    const onChange = vi.fn();
    const c = createConfirmController(onChange);
    expect(() => c.settle(true)).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("settling twice only resolves once; the second settle is a no-op", async () => {
    const onChange = vi.fn();
    const c = createConfirmController(onChange);
    const p = c.open(OPTS);
    c.settle(true);
    const closeCalls = onChange.mock.calls.filter(([open]) => open === false).length;
    c.settle(false); // should do nothing
    await expect(p).resolves.toBe(true);
    // no extra close notification from the second settle
    expect(onChange.mock.calls.filter(([open]) => open === false).length).toBe(closeCalls);
  });

  it("a second open() while one is pending cancels the stale promise (no hang)", async () => {
    const c = createConfirmController(() => {});
    const first = c.open(OPTS);
    const second = c.open({ title: "Other?" });
    // the first awaiter must settle (as cancelled) rather than hang forever
    await expect(first).resolves.toBe(false);
    c.settle(true);
    await expect(second).resolves.toBe(true);
  });
});
