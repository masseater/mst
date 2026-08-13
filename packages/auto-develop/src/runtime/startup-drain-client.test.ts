import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { runStartupDrainClient } from "./startup-drain-client.ts";

const BASE_URL = "https://relay.example";

describe("runStartupDrainClient の成功", () => {
  const it = test
    .extend("drainedEvents", () =>
      runStartupDrainClient({
        baseUrl: BASE_URL,
        mode: "reviewer",
        credentials: {
          authorizationFor: () => Promise.resolve("Bearer relay-token"),
          invalidate: () => undefined,
        },
        fetchImpl: vi.fn<typeof fetch>(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                events: [
                  {
                    schema_version: 1,
                    event_type: "pull_request",
                    delivery_id: "d-1",
                    payload: { number: 7 },
                  },
                  {
                    schema_version: 1,
                    event_type: "pull_request",
                    delivery_id: "d-2",
                    payload: { number: 7 },
                  },
                ],
              }),
              { status: 200 },
            ),
          ),
        ),
        log: silentLogger,
      }))
    .extend("emptyDrain", () =>
      runStartupDrainClient({
        baseUrl: BASE_URL,
        mode: "reviewer",
        credentials: {
          authorizationFor: () => Promise.resolve("Bearer relay-token"),
          invalidate: () => undefined,
        },
        fetchImpl: vi.fn<typeof fetch>(() =>
          Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 })),
        ),
        log: silentLogger,
      }),
    )
    .extend("startupDrainRequest", async () => {
      const startupDrainRequest = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 })),
      );
      await runStartupDrainClient({
        baseUrl: BASE_URL,
        mode: "author",
        credentials: {
          authorizationFor: () => Promise.resolve("Bearer relay-token"),
          invalidate: () => undefined,
        },
        fetchImpl: startupDrainRequest,
        log: silentLogger,
      });
      return startupDrainRequest;
    });

  it("封筒を開いた本文の並びを返す", ({ drainedEvents }) => {
    expect(drainedEvents).toStrictEqual([
      { number: 7, event_type: "pull_request", delivery_id: "d-1" },
      { number: 7, event_type: "pull_request", delivery_id: "d-2" },
    ]);
  });

  it("イベントが無ければ空の並びを返す", ({ emptyDrain }) => {
    expect(emptyDrain).toStrictEqual([]);
  });

  it("モードをクエリに載せて巻き取りを要求する", ({ startupDrainRequest }) => {
    expect(startupDrainRequest).toHaveBeenCalledWith(
      "https://relay.example/events/startup-drain?mode=author",
      { headers: { authorization: "Bearer relay-token" } },
    );
  });
});

describe("runStartupDrainClient の失敗", () => {
  const it = test
    .extend("unauthorizedRejection", async () => {
      try {
        await runStartupDrainClient({
          baseUrl: BASE_URL,
          mode: "reviewer",
          credentials: {
            authorizationFor: () => Promise.resolve("Bearer relay-token"),
            invalidate: () => undefined,
          },
          fetchImpl: vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(null, { status: 401 })),
          ),
          log: silentLogger,
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("巻き取りが拒否されなかった");
    })
    .extend("credentialInvalidation", async () => {
      const credentialInvalidation = vi.fn<() => void>();
      try {
        await runStartupDrainClient({
          baseUrl: BASE_URL,
          mode: "reviewer",
          credentials: {
            authorizationFor: () => Promise.resolve("Bearer relay-token"),
            invalidate: credentialInvalidation,
          },
          fetchImpl: vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(null, { status: 403 })),
          ),
          log: silentLogger,
        });
      } catch (rejection) {
        if (rejection instanceof CredentialTerminalError) return credentialInvalidation;
        throw rejection;
      }
      throw new Error("巻き取りが拒否されなかった");
    })
    .extend("retryableRejectionName", async () => {
      try {
        await runStartupDrainClient({
          baseUrl: BASE_URL,
          mode: "reviewer",
          credentials: {
            authorizationFor: () => Promise.resolve("Bearer relay-token"),
            invalidate: () => undefined,
          },
          fetchImpl: vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(null, { status: 503 })),
          ),
          log: silentLogger,
        });
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("巻き取りが拒否されなかった");
    })
    .extend("refusedRejection", async () => {
      try {
        await runStartupDrainClient({
          baseUrl: BASE_URL,
          mode: "reviewer",
          credentials: {
            authorizationFor: () => Promise.resolve("Bearer relay-token"),
            invalidate: () => undefined,
          },
          fetchImpl: vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(null, { status: 400 })),
          ),
          log: silentLogger,
        });
      } catch (rejection) {
        return rejection;
      }
      throw new Error("巻き取りが拒否されなかった");
    })
    .extend("shapelessRejectionName", async () => {
      try {
        await runStartupDrainClient({
          baseUrl: BASE_URL,
          mode: "reviewer",
          credentials: {
            authorizationFor: () => Promise.resolve("Bearer relay-token"),
            invalidate: () => undefined,
          },
          fetchImpl: vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(JSON.stringify({ nothing: true }), { status: 200 })),
          ),
          log: silentLogger,
        });
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("巻き取りが拒否されなかった");
    });

  it("認証拒否は恒久エラーになる", ({ unauthorizedRejection }) => {
    expect(unauthorizedRejection).toStrictEqual(
      new CredentialTerminalError("the relay rejected the startup drain credential"),
    );
  });

  it("認証拒否では credential を無効化する", ({ credentialInvalidation }) => {
    expect(credentialInvalidation).toHaveBeenCalledOnce();
  });

  it("5xx は再試行できる失敗として型付けする", ({ retryableRejectionName }) => {
    expect(retryableRejectionName).toBe("StartupDrainRejectedError");
  });

  it("認証以外の 4xx は恒久エラーになる", ({ refusedRejection }) => {
    expect(refusedRejection).toStrictEqual(
      new CredentialTerminalError("the relay refused the startup drain with heldStatus 400"),
    );
  });

  it("events 配列を欠く成功レスポンスは失敗として扱う", ({ shapelessRejectionName }) => {
    expect(shapelessRejectionName).toBe("InvalidEnvelopeError");
  });
});
