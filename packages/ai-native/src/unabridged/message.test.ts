import { describe, expect, test } from "vite-plus/test";

import { denyReasonFor } from "./message.ts";

describe("denyReasonFor", () => {
  const it = test
    .extend("theDenyReasonForTail", () => denyReasonFor(["tail"]))
    .extend("theDenyReasonForHeadAndTail", () => denyReasonFor(["head", "tail"]));

  it("names the one slicing command, states why it is refused, and lists the ways to read the whole record", ({
    theDenyReasonForTail,
  }) => {
    expect(theDenyReasonForTail).toBe(`unabridged: the command runs \`tail\`.
A slice drops the rest of the record, the failure is often in the part that was dropped, and re-running with a filter pays the cost twice while missing non-deterministic failures.

Read the whole record instead:
- output of a command: record it with \`spool -- <command>\`, then open the log file the summary points to with the Read tool. Where \`spool\` is not on PATH, \`vp exec spool -- <command>\` reaches it
- a file already on disk: open it with the Read tool, which takes offset and limit
- a record still being written: read it again with the Read tool, which sees whatever has been written so far`);
  });

  it("names both slicing commands when two of them were found", ({
    theDenyReasonForHeadAndTail,
  }) => {
    expect(theDenyReasonForHeadAndTail).toBe(`unabridged: the command runs \`head\` and \`tail\`.
A slice drops the rest of the record, the failure is often in the part that was dropped, and re-running with a filter pays the cost twice while missing non-deterministic failures.

Read the whole record instead:
- output of a command: record it with \`spool -- <command>\`, then open the log file the summary points to with the Read tool. Where \`spool\` is not on PATH, \`vp exec spool -- <command>\` reaches it
- a file already on disk: open it with the Read tool, which takes offset and limit
- a record still being written: read it again with the Read tool, which sees whatever has been written so far`);
  });
});
