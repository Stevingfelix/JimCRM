import { describe, it, expect, vi } from "vitest";
import { retry } from "./retry";

describe("retry", () => {
  it("returns the result on first success", async () => {
    const fn = vi.fn(async () => 42);
    const result = await retry(fn, { baseDelayMs: 1 });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 then succeeds", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw { status: 503, message: "service unavailable" };
      return "ok";
    });
    const result = await retry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 (rate limit)", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 3) throw { status: 429, message: "rate limited" };
      return "ok";
    });
    const result = await retry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 400 (bad request)", async () => {
    const fn = vi.fn(async () => {
      throw { status: 400, message: "bad request" };
    });
    await expect(retry(fn, { baseDelayMs: 1 })).rejects.toMatchObject({
      status: 400,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401 (auth)", async () => {
    const fn = vi.fn(async () => {
      throw { status: 401, message: "unauthorized" };
    });
    await expect(retry(fn, { baseDelayMs: 1 })).rejects.toMatchObject({
      status: 401,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on network errors (ECONNRESET)", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw new Error("ECONNRESET: connection reset");
      return "ok";
    });
    const result = await retry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on fetch failed", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw new Error("fetch failed");
      return "ok";
    });
    const result = await retry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts", async () => {
    const fn = vi.fn(async () => {
      throw { status: 503, message: "always failing" };
    });
    await expect(
      retry(fn, { baseDelayMs: 1, maxAttempts: 3 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry between attempts", async () => {
    const onRetry = vi.fn();
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw { status: 500 };
      return "done";
    };
    await retry(fn, { baseDelayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
