import { test, vi } from "vite-plus/test";

import { PROCESS_IO_MEMBER } from "../lint/oxlint/rules/no-logged-and-continued-failure--stop-or-recover.ts";
import { runAsyncProcess } from "../process-execution/async-process.ts";

type CapturedStream = {
  readonly chunks: readonly string[];
  readonly text: () => string;
};

/** @public */
export { runAsyncProcess, type CapturedStream };

const decoded = (writtenFragment: string | Uint8Array): string =>
  typeof writtenFragment === "string" ? writtenFragment : new TextDecoder().decode(writtenFragment);

const capturedWrites = (stream: NodeJS.WriteStream): CapturedStream => {
  const spy = vi.spyOn(stream, PROCESS_IO_MEMBER.write).mockImplementation(() => true);
  const written = (): readonly string[] =>
    spy.mock.calls.map(([writtenFragment]) => decoded(writtenFragment));

  return Object.create(Object.prototype, {
    chunks: { enumerable: true, get: written },
    text: { enumerable: false, value: () => written().join("") },
  }) as CapturedStream;
};

/** @public */
export const standardIoTest = test
  .extend("stdout", { auto: true }, () => capturedWrites(process.stdout))
  .extend("stderr", { auto: true }, () => capturedWrites(process.stderr));
