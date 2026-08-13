import { SERVER_SENT_EVENT_FIELD } from "../runtime/event-names.ts";

export type SseFrame = {
  readonly id?: string;
  readonly event?: string;
  readonly data: string;
};

type PartialFrame = {
  readonly id?: string;
  readonly event?: string;
  readonly data?: string;
};

const fieldValue = (line: string, field: string): string | undefined =>
  line.startsWith(`${field}:`) ? line.slice(field.length + 1).trim() : undefined;

const parseFrame = (block: string): PartialFrame =>
  block.split("\n").reduce<PartialFrame>((frame, line) => {
    const identity = fieldValue(line, SERVER_SENT_EVENT_FIELD.id);
    const frameEvent = fieldValue(line, SERVER_SENT_EVENT_FIELD.event);
    const dataEntry = fieldValue(line, SERVER_SENT_EVENT_FIELD.data);
    return {
      ...frame,
      ...(identity === undefined ? {} : { id: identity }),
      ...(frameEvent === undefined ? {} : { event: frameEvent }),
      ...(dataEntry === undefined ? {} : { data: dataEntry }),
    };
  }, {});

export const splitFrames = (
  buffered: string,
): { readonly frames: readonly SseFrame[]; readonly rest: string } => {
  const lastBreak = buffered.lastIndexOf("\n\n");
  if (lastBreak === -1) return { frames: [], rest: buffered };
  const frames = buffered
    .slice(0, lastBreak)
    .split("\n\n")
    .map(parseFrame)
    .filter((frame): frame is SseFrame => frame.data !== undefined);
  return { frames, rest: buffered.slice(lastBreak + 2) };
};
