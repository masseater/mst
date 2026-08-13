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
  scalarValueText,
  trailingComment,
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
    const it = test.extend("rootKeys", () =>
      keysOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  push:\n",
        }).root,
      ));

    it("keeps on as a key rather than reading it as a boolean", ({ rootKeys }) => {
      expect(rootKeys).toStrictEqual(["on"]);
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
    const it = test.extend("mappingEntryKeys", () =>
      entriesOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\njobs: {}\n",
        }).root,
      ).map(keyOf));

    it("lists the entries the mapping declares", ({ mappingEntryKeys }) => {
      expect(mappingEntryKeys).toStrictEqual(["name", "jobs"]);
    });
  });

  describe("something that is not a mapping", () => {
    const it = test.extend("sequenceEntries", () =>
      entriesOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "- one\n" }).root,
      ));

    it("reads as no entries at all", ({ sequenceEntries }) => {
      expect(sequenceEntries).toStrictEqual([]);
    });
  });
});

describe("itemsOf", () => {
  describe("a sequence", () => {
    const it = test.extend("sequenceItemTexts", () =>
      itemsOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "- one\n- two\n",
        }).root,
      ).map(scalarText));

    it("lists the items the sequence declares", ({ sequenceItemTexts }) => {
      expect(sequenceItemTexts).toStrictEqual(["one", "two"]);
    });
  });

  describe("something that is not a sequence", () => {
    const it = test.extend("mappingItems", () =>
      itemsOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
      ));

    it("reads as no items at all", ({ mappingItems }) => {
      expect(mappingItems).toStrictEqual([]);
    });
  });
});

describe("keyOf", () => {
  describe("an entry whose key is a plain value", () => {
    const it = test.extend("plainEntryKeys", () =>
      entriesOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
      ).map(keyOf));

    it("spells out the key of the entry", ({ plainEntryKeys }) => {
      expect(plainEntryKeys).toStrictEqual(["name"]);
    });
  });

  describe("an entry whose key is not a plain value", () => {
    const it = test.extend("nonPlainEntryKeys", () =>
      entriesOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "? [one]\n: two\n",
        }).root,
      ).map(keyOf));

    it("has no name for the entry", ({ nonPlainEntryKeys }) => {
      expect(nonPlainEntryKeys).toStrictEqual([null]);
    });
  });
});

describe("keysOf", () => {
  describe("a mapping holding an entry whose key is not a plain value", () => {
    const it = test.extend("mappingKeys", () =>
      keysOf(
        parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: CI\n? [one]\n: two\n",
        }).root,
      ));

    it("drops the entry whose key is not a plain value", ({ mappingKeys }) => {
      expect(mappingKeys).toStrictEqual(["name"]);
    });
  });
});

describe("entryOf", () => {
  describe("a name the mapping declares", () => {
    const it = test.extend("foundEntryKeyText", () =>
      scalarText(
        entryOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "name: CI\njobs: {}\n",
          }).root,
          "jobs",
        )?.key,
      ));

    it("finds the entry declared under the name", ({ foundEntryKeyText }) => {
      expect(foundEntryKeyText).toBe("jobs");
    });
  });

  describe("a name the mapping does not declare", () => {
    const it = test.extend("missingEntry", () =>
      entryOf(
        parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
          .root,
        "jobs",
      ));

    it("finds nothing", ({ missingEntry }) => {
      expect(missingEntry).toBe(null);
    });
  });
});

describe("valueOf", () => {
  describe("a name declared with a value", () => {
    const it = test.extend("declaredNameText", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "name: CI\n" })
            .root,
          "name",
        ),
      ));

    it("reads the value declared under the name", ({ declaredNameText }) => {
      expect(declaredNameText).toBe("CI");
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
    const it = test.extend("runCommandText", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "run: vp run guard\n",
          }).root,
          "run",
        ),
      ));

    it("reads the string the value spells out", ({ runCommandText }) => {
      expect(runCommandText).toBe("vp run guard");
    });
  });

  describe("a value that is not a string", () => {
    const it = test.extend("numericRunText", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source: "run: 7\n" })
            .root,
          "run",
        ),
      ));

    it("reads nothing", ({ numericRunText }) => {
      expect(numericRunText).toBe(null);
    });
  });

  describe("a value that is not a plain value at all", () => {
    const it = test.extend("nestedRunText", () =>
      scalarText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "run:\n  shell: bash\n",
          }).root,
          "run",
        ),
      ));

    it("reads nothing", ({ nestedRunText }) => {
      expect(nestedRunText).toBe(null);
    });
  });
});

describe("scalarValueText", () => {
  describe("a value written as a number", () => {
    const it = test.extend("fetchDepthText", () =>
      scalarValueText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "fetch-depth: 0\n",
          }).root,
          "fetch-depth",
        ),
      ));

    it("spells out a value written as a number", ({ fetchDepthText }) => {
      expect(fetchDepthText).toBe("0");
    });
  });

  describe("a value written as a string", () => {
    const it = test.extend("quotedFetchDepthText", () =>
      scalarValueText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: `fetch-depth: "0"\n`,
          }).root,
          "fetch-depth",
        ),
      ));

    it("spells out a value written as a string", ({ quotedFetchDepthText }) => {
      expect(quotedFetchDepthText).toBe("0");
    });
  });

  describe("a value written as a boolean", () => {
    const it = test.extend("cacheFlagText", () =>
      scalarValueText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "cache: true\n",
          }).root,
          "cache",
        ),
      ));

    it("spells out a value written as a boolean", ({ cacheFlagText }) => {
      expect(cacheFlagText).toBe("true");
    });
  });

  describe("a value written as nothing", () => {
    const it = test.extend("emptyFetchDepthText", () =>
      scalarValueText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "fetch-depth:\n",
          }).root,
          "fetch-depth",
        ),
      ));

    it("spells out nothing for a value written as nothing", ({ emptyFetchDepthText }) => {
      expect(emptyFetchDepthText).toBe(null);
    });
  });

  describe("a value that is not a plain value", () => {
    const it = test.extend("sequenceFetchDepthText", () =>
      scalarValueText(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "fetch-depth: [0]\n",
          }).root,
          "fetch-depth",
        ),
      ));

    it("spells out nothing for a value that is not a plain value", ({ sequenceFetchDepthText }) => {
      expect(sequenceFetchDepthText).toBe(null);
    });
  });
});

describe("trailingComment", () => {
  describe("a value written with a comment after it", () => {
    const it = test.extend("checkoutComment", () =>
      trailingComment(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "uses: actions/checkout # v5\n",
          }).root,
          "uses",
        ),
      ));

    it("reads the comment written after a value", ({ checkoutComment }) => {
      expect(checkoutComment).toBe(" v5");
    });
  });

  describe("a value written without a comment", () => {
    const it = test.extend("uncommentedCheckoutComment", () =>
      trailingComment(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "uses: actions/checkout\n",
          }).root,
          "uses",
        ),
      ));

    it("reads nothing from a value written without a comment", ({ uncommentedCheckoutComment }) => {
      expect(uncommentedCheckoutComment).toBe(null);
    });
  });

  describe("a value that is not a plain value", () => {
    const it = test.extend("sequenceUsesComment", () =>
      trailingComment(
        valueOf(
          parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: "uses:\n  - one\n",
          }).root,
          "uses",
        ),
      ));

    it("reads nothing from a value that is not a plain value", ({ sequenceUsesComment }) => {
      expect(sequenceUsesComment).toBe(null);
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
