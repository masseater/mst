import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { openTypeScriptApi } from "./open-api.ts";

describe("openTypeScriptApi", () => {
  describe("a directory holding no package of its own", () => {
    const it = test.extend("closedApi", ({}, { onCleanup }) => {
      const packageDirectory = mkdtempSync(join(tmpdir(), "open-type-script-api-"));
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      openTypeScriptApi(packageDirectory).close();
    });

    it("hands back an API that closes on the directory it was opened at", ({ closedApi }) => {
      expect(closedApi).toBe(undefined);
    });
  });
});
