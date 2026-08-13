import { describe, expect } from "vite-plus/test";

import { standardIoTest } from "./standard-io-test.ts";

describe("standardIoTest", () => {
  describe("a run that writes a string and an encoded chunk to standard output", () => {
    const it = standardIoTest.extend("theMixedRun", { auto: true }, () => {
      process.stdout.write("progress line\n");
      process.stdout.write(new TextEncoder().encode("encoded line\n"));
    });

    it("records both chunks decoded in the order they were written", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "progress line
        ",
            "encoded line
        ",
          ],
        }
      `);
    });

    it("leaves the stream the run never wrote to with nothing recorded", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });
  });

  describe("a run that writes to both streams", () => {
    const it = standardIoTest.extend("theRunThatWroteToBothStreams", { auto: true }, () => {
      process.stdout.write("result");
      process.stderr.write("diagnostic");
    });

    it("keeps what went to standard error out of standard output", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "result",
          ],
        }
      `);
    });

    it("keeps what went to standard output out of standard error", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "diagnostic",
          ],
        }
      `);
    });
  });

  describe("a run whose chunks are folded into one text", () => {
    const it = standardIoTest
      .extend("theFoldedStandardOutput", ({ stdout }) => {
        process.stdout.write("first ");
        process.stdout.write("second");
        return stdout.text();
      })
      .extend("theFoldedStandardError", ({ stderr }) => {
        process.stderr.write("first ");
        process.stderr.write("second");
        return stderr.text();
      });

    it("joins what was written to standard output in order", ({ theFoldedStandardOutput }) => {
      expect(theFoldedStandardOutput).toBe("first second");
    });

    it("joins what was written to standard error in order", ({ theFoldedStandardError }) => {
      expect(theFoldedStandardError).toBe("first second");
    });
  });
});
