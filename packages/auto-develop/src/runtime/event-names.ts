/** @canonical-values auto-develop.socket-lifecycle-event */
const SOCKET_LIFECYCLE_EVENTS = ["connection", "close", "error"] as const;

export const SOCKET_LIFECYCLE_EVENT = {
  connection: SOCKET_LIFECYCLE_EVENTS[0],
  close: SOCKET_LIFECYCLE_EVENTS[1],
  failure: SOCKET_LIFECYCLE_EVENTS[2],
} as const;

/** @canonical-values auto-develop.abort-signal-event */
const ABORT_SIGNAL_EVENTS = ["abort"] as const;

export const ABORT_SIGNAL_EVENT = {
  abort: ABORT_SIGNAL_EVENTS[0],
} as const;

/** @canonical-values auto-develop.child-process-event */
const CHILD_PROCESS_EVENTS = ["exit"] as const;

export const CHILD_PROCESS_EVENT = {
  exit: CHILD_PROCESS_EVENTS[0],
} as const;

/** @canonical-values auto-develop.server-sent-event-data-field */
const SERVER_SENT_EVENT_DATA_FIELDS = ["data"] as const;

export const SERVER_SENT_EVENT_FIELD = {
  id: "id",
  event: "event",
  data: SERVER_SENT_EVENT_DATA_FIELDS[0],
} as const;
