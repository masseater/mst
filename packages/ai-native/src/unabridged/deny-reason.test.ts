import { describe, expect, test } from "vite-plus/test";

import { denyReasonOf } from "./deny-reason.ts";

describe("denyReasonOf", () => {
  test("Bash のコマンド位置に tail があれば理由を返す", () => {
    expect(denyReasonOf("Bash", { command: "vp test | tail -50" })).toContain(
      "unabridged: the command runs `tail`.",
    );
  });

  test("Bash でもコマンド位置に無ければ理由を返さない", () => {
    expect(denyReasonOf("Bash", { command: "git rev-parse HEAD" })).toBeUndefined();
  });

  test.each([
    ["Read", { file_path: "/repo/x.ts" }],
    ["Read", { command: "vp test | tail -5" }],
    ["Bash", null],
    ["Bash", "vp test | tail -5"],
    ["Bash", {}],
    ["Bash", { command: 7 }],
  ] as const)(
    "%s の %j からはコマンド行を読み取れないので理由を返さない",
    (toolName, toolInput) => {
      expect(denyReasonOf(toolName, toolInput)).toBeUndefined();
    },
  );
});
