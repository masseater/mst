import { describe, expect, test } from "vite-plus/test";

import { denyReasonFor } from "./message.ts";

describe("denyReasonFor", () => {
  test("見つかった名前を挙げ、禁止の理由を述べてから直し方を並べる", () => {
    const reason = denyReasonFor(["tail"]);
    expect(reason.split("\n")[0]).toBe("unabridged: the command runs `tail`.");
    expect(reason).toContain("vp exec spool -- <command>");
    expect(reason).toContain("Read tool, which takes offset and limit");
  });

  test("名前が複数あるときは両方を挙げる", () => {
    expect(denyReasonFor(["head", "tail"]).split("\n")[0]).toBe(
      "unabridged: the command runs `head` and `tail`.",
    );
  });
});
