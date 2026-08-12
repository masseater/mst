import * as citty from "citty";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { dontReviewItCommand } from "./dont-review-it-command.ts";

vi.mock(import("citty"), { spy: true });

describe("cli entrypoint", () => {
  test("it runs the public command through citty", async () => {
    const runMain = vi.mocked(citty.runMain);
    runMain.mockResolvedValue();
    onTestFinished(() => {
      runMain.mockReset();
    });

    await import("./cli.ts");

    expect(runMain).toHaveBeenCalledExactlyOnceWith(dontReviewItCommand);
  });
});
