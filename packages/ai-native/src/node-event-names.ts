/** @canonical-values ai-native.child-process-event */
const CHILD_PROCESS_EVENTS = ["spawn", "error", "close", "exit"] as const;

export const CHILD_PROCESS_EVENT = {
  spawn: CHILD_PROCESS_EVENTS[0],
  failure: CHILD_PROCESS_EVENTS[1],
  close: CHILD_PROCESS_EVENTS[2],
  exit: CHILD_PROCESS_EVENTS[3],
} as const;

/** @canonical-values ai-native.stream-event */
const STREAM_EVENTS = ["data", "error"] as const;

export const STREAM_EVENT = {
  data: STREAM_EVENTS[0],
  failure: STREAM_EVENTS[1],
} as const;
