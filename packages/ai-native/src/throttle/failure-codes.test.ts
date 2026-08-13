import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { failureSpelling } from "./failure-codes.ts";

describe("failureSpelling", () => {
  describe("a refusal the file system named with a code", () => {
    const it = test.extend("theSpellingOfACodedRefusal", () => {
      const [refusal] = attempt<string, Error>(() =>
        readFileSync(join(tmpdir(), "throttle-marker-that-was-never-written"), "utf8"),
      );
      return failureSpelling(refusal);
    });

    it("spells the refusal by its code", ({ theSpellingOfACodedRefusal }) => {
      expect(theSpellingOfACodedRefusal).toBe("ENOENT");
    });
  });

  describe("a refusal carrying no code at all", () => {
    const it = test.extend("theSpellingOfACodelessRefusal", () =>
      failureSpelling(new Error("the marker could not be read at all")));

    it("spells the refusal by what it says", ({ theSpellingOfACodelessRefusal }) => {
      expect(theSpellingOfACodelessRefusal).toBe("Error: the marker could not be read at all");
    });
  });

  describe("a refusal that is not an error at all", () => {
    const it = test.extend("theSpellingOfAnUnerringRefusal", () => failureSpelling("refused"));

    it("spells the refusal by what it says", ({ theSpellingOfAnUnerringRefusal }) => {
      expect(theSpellingOfAnUnerringRefusal).toBe("refused");
    });
  });

  describe("a refusal whose code is not spelled as text", () => {
    const it = test.extend("theSpellingOfAnUnspelledCode", () => {
      class RefusalCarryingANumberedCode extends Error {
        readonly code = 13;
      }
      return failureSpelling(new RefusalCarryingANumberedCode("the marker could not be read"));
    });

    it("spells the refusal by what it says", ({ theSpellingOfAnUnspelledCode }) => {
      expect(theSpellingOfAnUnspelledCode).toBe("Error: the marker could not be read");
    });
  });
});
