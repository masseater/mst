import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import {
  CredentialTerminalError,
  type CredentialProvider,
} from "../transport/credential-provider.ts";
import { runStartupDrainClient } from "./startup-drain-client.ts";

const BASE_URL = "https://relay.example";

const envelopeOf = (deliveryId: string): Readonly<Record<string, unknown>> => ({
  schema_version: 1,
  event_type: "pull_request",
  delivery_id: deliveryId,
  payload: { number: 7 },
});

const credentialsWith = (invalidate: () => void = () => undefined): CredentialProvider => ({
  authorizationFor: () => Promise.resolve("Bearer relay-token"),
  invalidate,
});

const responseOf = (setup: { readonly status: number; readonly body?: unknown }): Response =>
  new Response(setup.body === undefined ? null : JSON.stringify(setup.body), {
    status: setup.status,
    headers: { "content-type": "application/json" },
  });

const drainWith = async (setup: {
  readonly status: number;
  readonly body?: unknown;
  readonly onInvalidate?: () => void;
}): Promise<unknown> => {
  const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(responseOf(setup)));
  try {
    return await runStartupDrainClient({
      baseUrl: BASE_URL,
      mode: "reviewer",
      credentials: credentialsWith(setup.onInvalidate),
      fetchImpl,
      log: silentLogger,
    });
  } catch (drainFailure) {
    return drainFailure;
  }
};

const it = test
  .extend("drainedEvents", () =>
    drainWith({ status: 200, body: { events: [envelopeOf("d-1"), envelopeOf("d-2")] } }))
  .extend("emptyDrain", () => drainWith({ status: 200, body: { events: [] } }))
  .extend("unauthorizedFailure", () => drainWith({ status: 401, body: {} }))
  .extend("invalidateCallCount", async () => {
    const invalidate = vi.fn<() => void>();
    await drainWith({ status: 403, body: {}, onInvalidate: invalidate });
    return invalidate.mock.calls.length;
  })
  .extend("retryableFailureName", async () => {
    const rejection = await drainWith({ status: 503, body: {} });
    return rejection instanceof Error ? rejection.name : typeof rejection;
  })
  .extend("permanentFailure", () => drainWith({ status: 400, body: {} }))
  .extend("shapelessFailure", () => drainWith({ status: 200, body: { nothing: true } }))
  .extend("requestedUrl", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(responseOf({ status: 200, body: { events: [] } })),
    );
    await runStartupDrainClient({
      baseUrl: BASE_URL,
      mode: "author",
      credentials: credentialsWith(),
      fetchImpl,
      log: silentLogger,
    });
    return fetchImpl.mock.calls[0]?.[0];
  });

describe("runStartupDrainClient の成功", () => {
  it("封筒を開いた本文の並びを返す", ({ drainedEvents }) => {
    expect(drainedEvents).toStrictEqual([
      { number: 7, event_type: "pull_request", delivery_id: "d-1" },
      { number: 7, event_type: "pull_request", delivery_id: "d-2" },
    ]);
  });

  it("イベントが無ければ空の並びを返す", ({ emptyDrain }) => {
    expect(emptyDrain).toStrictEqual([]);
  });

  it("モードをクエリに載せて巻き取りを要求する", ({ requestedUrl }) => {
    expect(requestedUrl).toStrictEqual("https://relay.example/events/startup-drain?mode=author");
  });
});

describe("runStartupDrainClient の失敗", () => {
  it("認証拒否は恒久エラーになる", ({ unauthorizedFailure }) => {
    expect(unauthorizedFailure).toBeInstanceOf(CredentialTerminalError);
  });

  it("認証拒否では credential を無効化する", ({ invalidateCallCount }) => {
    expect(invalidateCallCount).toStrictEqual(1);
  });

  it("5xx は再試行できる失敗として型付けする", ({ retryableFailureName }) => {
    expect(retryableFailureName).toStrictEqual("StartupDrainRejectedError");
  });

  it("認証以外の 4xx は恒久エラーになる", ({ permanentFailure }) => {
    expect(permanentFailure).toBeInstanceOf(CredentialTerminalError);
  });

  it("events 配列を欠く成功レスポンスは失敗として扱う", ({ shapelessFailure }) => {
    expect(shapelessFailure).toBeInstanceOf(Error);
  });
});
