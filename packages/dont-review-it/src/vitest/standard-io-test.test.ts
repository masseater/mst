import { describe, expect } from "vite-plus/test";

import { standardIoTest } from "./standard-io-test.ts";

describe("standardIoTest", () => {
  standardIoTest("hands the subject everything written to stdout", ({ stdout }) => {
    process.stdout.write("progress line\n");
    process.stdout.write(new TextEncoder().encode("encoded line\n"));

    expect(stdout.text).toBe("progress line\nencoded line\n");
  });

  standardIoTest("hands the subject everything written to stderr", ({ stderr }) => {
    process.stderr.write("something failed\n");

    expect(stderr.text).toBe("something failed\n");
  });

  standardIoTest("keeps the two streams apart", ({ stdout, stderr }) => {
    process.stdout.write("result");
    process.stderr.write("diagnostic");

    expect(stdout.text).toBe("result");
    expect(stderr.text).toBe("diagnostic");
  });

  standardIoTest("matches the stdout snapshot", ({ stdout }) => {
    process.stdout.write("result\n");

    expect(stdout.text).toMatchInlineSnapshot(`
      "result
      "
    `);
  });

  standardIoTest("matches the stderr snapshot", ({ stderr }) => {
    process.stderr.write("diagnostic\n");

    expect(stderr.text).toMatchInlineSnapshot(`
      "diagnostic
      "
    `);
  });
});
