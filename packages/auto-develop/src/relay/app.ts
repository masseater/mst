import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import {
  AUTH_SESSION_PATH,
  CHECK_BASE_UPDATES_PATH,
  EVENT_POLL_PATH,
  EVENT_STREAM_PATH,
  STARTUP_DRAIN_PATH,
} from "../contract/endpoints.ts";
import {
  handleCheckBaseUpdatesRoute,
  handleHealthRoute,
  handlePollRoute,
  handleSessionRoute,
  handleStartupDrainRoute,
  handleStreamRoute,
  handleWebhookRoute,
  respondJson,
  type RelayDependencies,
  type RouteContext,
} from "./routes.ts";

import type { Socket } from "node:net";

const HEALTH_PATH = "/health";

const WEBHOOK_PATH = "/webhook";

const DRAIN_BUDGET_MS = 1000;

const routeTable = new Map<string, (context: RouteContext) => Promise<void> | void>([
  [`GET ${HEALTH_PATH}`, handleHealthRoute],
  [`POST ${WEBHOOK_PATH}`, handleWebhookRoute],
  [`POST ${AUTH_SESSION_PATH}`, handleSessionRoute],
  [`GET ${EVENT_STREAM_PATH}`, handleStreamRoute],
  [`GET ${EVENT_POLL_PATH}`, handlePollRoute],
  [`GET ${STARTUP_DRAIN_PATH}`, handleStartupDrainRoute],
  [`POST ${CHECK_BASE_UPDATES_PATH}`, handleCheckBaseUpdatesRoute],
]);

const dispatch = async (dispatching: {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly deps: RelayDependencies;
}): Promise<void> => {
  const requestUrl = new URL(dispatching.req.url as string, "http://relay.internal");
  const routeHandler = routeTable.get(`${dispatching.req.method ?? "GET"} ${requestUrl.pathname}`);
  if (routeHandler === undefined) {
    respondJson({ res: dispatching.res, status: 404, body: { error: "Not Found" } });
    return;
  }
  await routeHandler({ ...dispatching, requestUrl });
};

export type RelayServer = {
  readonly server: Server;
  readonly shutdown: () => Promise<void>;
};

export const createRelayServer = (deps: RelayDependencies): RelayServer => {
  const openSockets = new Set<Socket>();
  const handleRequest = async (handling: {
    readonly req: IncomingMessage;
    readonly res: ServerResponse;
  }): Promise<void> => {
    try {
      await dispatch({ ...handling, deps });
    } catch (failure) {
      deps.log.error(
        { err: failure, method: handling.req.method, path: handling.req.url },
        "unhandled route failure",
      );
      if (!handling.res.headersSent) {
        respondJson({ res: handling.res, status: 500, body: { error: "Internal Server Error" } });
        return;
      }
      handling.res.end();
    }
  };
  const server = createServer((asked, produced) => {
    void handleRequest({ req: asked, res: produced });
  });
  server.on("connection", (socket) => {
    openSockets.add(socket);
    socket.on("close", () => {
      openSockets.delete(socket);
    });
  });

  const shutdown = (): Promise<void> =>
    new Promise((resolve) => {
      deps.log.info({}, "relay server draining connections");
      const forcedClose = setTimeout(() => {
        for (const socket of openSockets) socket.destroy();
      }, DRAIN_BUDGET_MS);
      server.close(() => {
        clearTimeout(forcedClose);
        resolve();
      });
    });

  return { server, shutdown };
};
