import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect } from "vite-plus/test";

import { warnUnreleased } from "./unreleased-warning.ts";

describe("warnUnreleased", () => {
  describe("a slot that could not be given back", () => {
    const it = standardIoTest
      .extend("theWarningOnStandardError", ({ stderr }) => {
        warnUnreleased(new Error("releasing the slot before re-raising SIGINT failed"));
        return stderr.text();
      })
      .extend("theStandardOutputOfTheWarning", ({ stdout }) => {
        warnUnreleased(new Error("releasing the slot before re-raising SIGINT failed"));
        return stdout.text();
      });

    it("names the failure under the tool that owns the slot", ({ theWarningOnStandardError }) => {
      expect(theWarningOnStandardError).toMatchInlineSnapshot(`
        "throttle: releasing the slot before re-raising SIGINT failed
        "
      `);
    });

    it("leaves standard output untouched", ({ theStandardOutputOfTheWarning }) => {
      expect(theStandardOutputOfTheWarning).toMatchInlineSnapshot(`""`);
    });
  });
});
