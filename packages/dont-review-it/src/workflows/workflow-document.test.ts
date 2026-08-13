import { describe, expect, test } from "vite-plus/test";

import {
  entriesOf,
  entryOf,
  isTruthyScalar,
  itemsOf,
  keyOf,
  keysOf,
  lineAtOffset,
  lineOf,
  parseWorkflowDocument,
  scalarText,
  valueOf,
} from "./workflow-document.ts";

describe("parseWorkflowDocument", () => {
  describe("a definition carrying syntax that cannot be read", () => {
    const it = test.extend("failureLines", () => {
      const document = parseWorkflowDocument({
        relativePath: ".github/workflows/ci.yml",
        source: "name: CI\n  on: push\n",
      });

      return document.parseFailureOffsets.map((offset) => lineAtOffset(document, offset));
    });

    it("reports the position every failure stands on", ({ failureLines }) => {
      expect(failureLines).toStrictEqual([1, 1]);
    });
  });

  describe("a definition that reads", () => {
    const it = test.extend("failureLines", () => {
      const document = parseWorkflowDocument({
        relativePath: ".github/workflows/ci.yml",
        source: "name: CI\n",
      });

      return document.parseFailureOffsets.map((offset) => lineAtOffset(document, offset));
    });

    it("reports no position at all", ({ failureLines }) => {
      expect(failureLines).toStrictEqual([]);
    });
  });

  describe("a definition whose triggers are written under on", () => {
    const it = test.extend("keys", () =>
      keysOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  push:\n",
        }).root,
      ));

    it("keeps on as a key rather than reading it as a boolean", ({ keys }) => {
      expect(keys).toStrictEqual(["on"]);
    });
  });
});

describe("lineOf", () => {
  describe("a node the definition carries a position for", () => {
    const it = test.extend("line", () => {
      const document = parseWorkflowDocument({
        relativePath: ".github/workflows/ci.yml",
        source: "name: CI\njobs:\n  build: {}\n",
      });

      return lineOf(document, entryOf(document.root, "jobs")?.key);
    });

    it("counts the line the node starts on", ({ line }) => {
      expect(line).toBe(2);
    });
  });

  describe("a node that carries no position", () => {
    const it = test.extend("line", () =>
      lineOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\n",
        }),
        null,
      ));

    it("falls back to the first line", ({ line }) => {
      expect(line).toBe(1);
    });
  });
});

describe("entriesOf", () => {
  describe("a mapping", () => {
    const it = test.extend("keys", () =>
      entriesOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\njobs: {}\n",
        }).root,
      ).map(keyOf));

    it("lists the entries the mapping declares", ({ keys }) => {
      expect(keys).toStrictEqual(["name", "jobs"]);
    });
  });

  describe("something that is not a mapping", () => {
    const it = test.extend("entries", () =>
      entriesOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "- one\n" }).root,
      ));

    it("reads as no entries at all", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });
});

describe("itemsOf", () => {
  describe("a sequence", () => {
    const it = test.extend("texts", () =>
      itemsOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "- one\n- two\n",
        }).root,
      ).map(scalarText));

    it("lists the items the sequence declares", ({ texts }) => {
      expect(texts).toStrictEqual(["one", "two"]);
    });
  });

  describe("something that is not a sequence", () => {
    const it = test.extend("items", () =>
      itemsOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
      ));

    it("reads as no items at all", ({ items }) => {
      expect(items).toStrictEqual([]);
    });
  });
});

describe("keyOf", () => {
  describe("an entry whose key is a plain value", () => {
    const it = test.extend("keys", () =>
      entriesOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
      ).map(keyOf));

    it("spells out the key of the entry", ({ keys }) => {
      expect(keys).toStrictEqual(["name"]);
    });
  });

  describe("an entry whose key is not a plain value", () => {
    const it = test.extend("keys", () =>
      entriesOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "? [one]\n: two\n",
        }).root,
      ).map(keyOf));

    it("has no name for the entry", ({ keys }) => {
      expect(keys).toStrictEqual([null]);
    });
  });
});

describe("keysOf", () => {
  describe("a mapping holding an entry whose key is not a plain value", () => {
    const it = test.extend("keys", () =>
      keysOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\n? [one]\n: two\n",
        }).root,
      ));

    it("drops the entry whose key is not a plain value", ({ keys }) => {
      expect(keys).toStrictEqual(["name"]);
    });
  });
});

describe("entryOf", () => {
  describe("a name the mapping declares", () => {
    const it = test.extend("key", () =>
      scalarText(
        entryOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "name: CI\njobs: {}\n",
          }).root,
          "jobs",
        )?.key,
      ));

    it("finds the entry declared under the name", ({ key }) => {
      expect(key).toBe("jobs");
    });
  });

  describe("a name the mapping does not declare", () => {
    const it = test.extend("entry", () =>
      entryOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
        "jobs",
      ));

    it("finds nothing", ({ entry }) => {
      expect(entry).toBe(null);
    });
  });
});

describe("valueOf", () => {
  describe("a name declared with a value", () => {
    const it = test.extend("text", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
            .root,
          "name",
        ),
      ));

    it("reads the value declared under the name", ({ text }) => {
      expect(text).toBe("CI");
    });
  });

  describe("a name written without a value at all", () => {
    const it = test.extend("declaredValue", () =>
      valueOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "{ on }\n" })
          .root,
        "on",
      ));

    it("reads nothing", ({ declaredValue }) => {
      expect(declaredValue).toBe(null);
    });
  });

  describe("a name the mapping does not declare", () => {
    const it = test.extend("declaredValue", () =>
      valueOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
        "jobs",
      ));

    it("reads nothing", ({ declaredValue }) => {
      expect(declaredValue).toBe(null);
    });
  });
});

describe("scalarText", () => {
  describe("a plain string value", () => {
    const it = test.extend("text", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "run: vp run guard\n",
          }).root,
          "run",
        ),
      ));

    it("reads the string the value spells out", ({ text }) => {
      expect(text).toBe("vp run guard");
    });
  });

  describe("a value that is not a string", () => {
    const it = test.extend("text", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "run: 7\n" })
            .root,
          "run",
        ),
      ));

    it("reads nothing", ({ text }) => {
      expect(text).toBe(null);
    });
  });

  describe("a value that is not a plain value at all", () => {
    const it = test.extend("text", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "run:\n  shell: bash\n",
          }).root,
          "run",
        ),
      ));

    it("reads nothing", ({ text }) => {
      expect(text).toBe(null);
    });
  });
});

describe("isTruthyScalar", () => {
  describe("a value declared as true", () => {
    const it = test.extend("verdict", () =>
      isTruthyScalar(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "continue-on-error: true\n",
          }).root,
          "continue-on-error",
        ),
      ));

    it("recognises the value", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a value declared as false", () => {
    const it = test.extend("verdict", () =>
      isTruthyScalar(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "continue-on-error: false\n",
          }).root,
          "continue-on-error",
        ),
      ));

    it("does not recognise the value", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a value that is not a plain value", () => {
    const it = test.extend("verdict", () =>
      isTruthyScalar(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "continue-on-error: [true]\n",
          }).root,
          "continue-on-error",
        ),
      ));

    it("does not recognise the value", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
