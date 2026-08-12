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
    const id = fieldValue(line, "id");
    const event = fieldValue(line, "event");
    const dataEntry = fieldValue(line, "data");
    return {
      ...frame,
      ...(id === undefined ? {} : { id }),
      ...(event === undefined ? {} : { event }),
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
