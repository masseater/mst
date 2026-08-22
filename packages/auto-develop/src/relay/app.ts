import { on } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import {
  AUTH_SESSION_PATH,
  CHECK_BASE_UPDATES_PATH,
  EVENT_POLL_PATH,
  EVENT_STREAM_PATH,
  STARTUP_DRAIN_PATH,
} from "../contract/endpoints.ts";
import { SOCKET_LIFECYCLE_EVENT } from "../runtime/event-names.ts";
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
  const serve = async (serving: {
    readonly req: IncomingMessage;
    readonly res: ServerResponse;
  }): Promise<void> => {
    try {
      await dispatch({ ...serving, deps });
    } catch (failure) {
      deps.log.error(
        { err: failure, method: serving.req.method, path: serving.req.url },
        "unhandled route failure",
      );
      if (!serving.res.headersSent) {
        respondJson({ res: serving.res, status: 500, body: { error: "Internal Server Error" } });
        return;
      }
      serving.res.end();
    }
  };

  const server = createServer();

  const acceptRequests = async (accepting: {
    readonly arrivals: AsyncIterator<readonly [IncomingMessage, ServerResponse]>;
  }): Promise<void> => {
    const arrived = await accepting.arrivals.next();
    if (arrived.done === true) return;
    const [asked, produced] = arrived.value;
    await Promise.all([serve({ req: asked, res: produced }), acceptRequests(accepting)]);
  };

  const accepted = acceptRequests({
    arrivals: on(server, "request", {
      close: [SOCKET_LIFECYCLE_EVENT.close],
    }) as AsyncIterator<readonly [IncomingMessage, ServerResponse]>,
  });

  const closeServer = (): Promise<void> =>
    new Promise((resolve) => {
      deps.log.info({}, "relay server draining connections");
      const forcedClose = setTimeout(() => {
        server.closeAllConnections();
      }, DRAIN_BUDGET_MS);
      server.close(() => {
        clearTimeout(forcedClose);
        resolve();
      });
    });

  const shutdown = async (): Promise<void> => {
    await closeServer();
    await accepted;
  };

  return { server, shutdown };
};
