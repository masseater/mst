import { test, vi } from "vite-plus/test";

import { PROCESS_IO_MEMBER } from "../lint/oxlint/rules/no-logged-and-continued-failure--stop-or-recover.ts";

type CapturedStream = {
  readonly text: string;
};

const decoded = (writtenChunk: string | Uint8Array): string =>
  typeof writtenChunk === "string" ? writtenChunk : new TextDecoder().decode(writtenChunk);

const captureWrites = (stream: NodeJS.WriteStream) => {
  const spy = vi.spyOn(stream, PROCESS_IO_MEMBER.write).mockImplementation(() => true);
  return {
    subject: {
      get text(): string {
        return spy.mock.calls.map(([writtenChunk]) => decoded(writtenChunk)).join("");
      },
    },
    restore: (): void => {
      spy.mockRestore();
    },
  };
};

/** @public */
export const standardIoTest = test.extend<{ stdout: CapturedStream; stderr: CapturedStream }>({
  stdout: async ({}, use) => {
    const capture = captureWrites(process.stdout);
    await use(capture.subject);
    capture.restore();
  },
  stderr: async ({}, use) => {
    const capture = captureWrites(process.stderr);
    await use(capture.subject);
    capture.restore();
  },
});
