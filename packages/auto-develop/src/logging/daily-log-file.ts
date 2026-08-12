import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type LogFileSink = {
  readonly append: (line: string) => void;
};

const dailyLogFileName = (spelled: string, isoTime: string): string =>
  `${spelled}-${isoTime.slice(0, 10)}.log`;

export const createDailyLogFileSink = (sink: {
  readonly directory: string;
  readonly name: string;
  readonly nowIso: () => string;
  readonly onFailure: (failure: unknown) => void;
}): LogFileSink => {
  const prepared = new Set<string>();
  return {
    append: (line) => {
      const fileName = dailyLogFileName(sink.name, sink.nowIso());
      try {
        if (!prepared.has(fileName)) {
          mkdirSync(sink.directory, { recursive: true });
          prepared.add(fileName);
        }
        appendFileSync(join(sink.directory, fileName), line);
      } catch (appendFailure) {
        sink.onFailure(appendFailure);
      }
    },
  };
};
