import { describe, expect, test } from "vite-plus/test";

import { denyReasonOf } from "./deny-reason.ts";

describe("denyReasonOf", () => {
  describe("a Bash command line that slices its output", () => {
    const it = test.extend("theDenyReasonOfABashCommandLineThatTails", () =>
      denyReasonOf("Bash", { command: "vp test | tail -50" }));

    it("names the slicing command and hands back the whole refusal", ({
      theDenyReasonOfABashCommandLineThatTails,
    }) => {
      expect(theDenyReasonOfABashCommandLineThatTails).toBe(`unabridged: the command runs \`tail\`.
A slice drops the rest of the record, the failure is often in the part that was dropped, and re-running with a filter pays the cost twice while missing non-deterministic failures.

Read the whole record instead:
- output of a command: record it with \`spool -- <command>\`, then open the log file the summary points to with the Read tool. Where \`spool\` is not on PATH, \`vp exec spool -- <command>\` reaches it
- a file already on disk: open it with the Read tool, which takes offset and limit
- a record still being written: read it again with the Read tool, which sees whatever has been written so far`);
    });
  });

  describe("a Bash command line that keeps its record whole", () => {
    const it = test.extend("theDenyReasonOfABashCommandLineThatSlicesNothing", () =>
      denyReasonOf("Bash", { command: "git rev-parse HEAD" }));

    it("refuses nothing", ({ theDenyReasonOfABashCommandLineThatSlicesNothing }) => {
      expect(theDenyReasonOfABashCommandLineThatSlicesNothing).toBe(undefined);
    });
  });

  describe("a tool call no command line can be read out of", () => {
    const it = test
      .extend("theDenyReasonOfAReadOfAFilePath", () =>
        denyReasonOf("Read", { file_path: "/repo/x.ts" }))
      .extend("theDenyReasonOfAReadWhoseInputTails", () =>
        denyReasonOf("Read", { command: "vp test | tail -5" }),
      )
      .extend("theDenyReasonOfABashCallHandedNothing", () => denyReasonOf("Bash", null))
      .extend("theDenyReasonOfABashCallHandedABareString", () =>
        denyReasonOf("Bash", "vp test | tail -5"),
      )
      .extend("theDenyReasonOfABashCallHandedAnEmptyInput", () => denyReasonOf("Bash", {}))
      .extend("theDenyReasonOfABashCallWhoseCommandIsANumber", () =>
        denyReasonOf("Bash", { command: 7 }),
      );

    it("refuses nothing for a Read holding a file path", ({ theDenyReasonOfAReadOfAFilePath }) => {
      expect(theDenyReasonOfAReadOfAFilePath).toBe(undefined);
    });

    it("refuses nothing for a Read whose input carries a slicing command line", ({
      theDenyReasonOfAReadWhoseInputTails,
    }) => {
      expect(theDenyReasonOfAReadWhoseInputTails).toBe(undefined);
    });

    it("refuses nothing for a Bash call handed no input", ({
      theDenyReasonOfABashCallHandedNothing,
    }) => {
      expect(theDenyReasonOfABashCallHandedNothing).toBe(undefined);
    });

    it("refuses nothing for a Bash call handed a bare string", ({
      theDenyReasonOfABashCallHandedABareString,
    }) => {
      expect(theDenyReasonOfABashCallHandedABareString).toBe(undefined);
    });

    it("refuses nothing for a Bash call handed an input without a command line", ({
      theDenyReasonOfABashCallHandedAnEmptyInput,
    }) => {
      expect(theDenyReasonOfABashCallHandedAnEmptyInput).toBe(undefined);
    });

    it("refuses nothing for a Bash call whose command line is not a string", ({
      theDenyReasonOfABashCallWhoseCommandIsANumber,
    }) => {
      expect(theDenyReasonOfABashCallWhoseCommandIsANumber).toBe(undefined);
    });
  });
});
