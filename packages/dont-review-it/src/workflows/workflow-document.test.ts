import { describe, expect, it } from "vite-plus/test";

import {
  entriesOf,
  entryOf,
  isTruthyScalar,
  itemsOf,
  keyOf,
  keysOf,
  lineOf,
  parseWorkflowDocument,
  scalarText,
  valueOf,
} from "./workflow-document.ts";

const documentOf = (source: string) =>
  parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source });

describe("parseWorkflowDocument", () => {
  it("reports the position of syntax that cannot be read", () => {
    expect(documentOf("name: CI\n  on: push\n").parseFailureOffsets.length).toBeGreaterThan(0);
  });

  it("leaves the failure list empty when the definition reads", () => {
    expect(documentOf("name: CI\n").parseFailureOffsets).toStrictEqual([]);
  });

  it("keeps on as a key rather than reading it as a boolean", () => {
    expect(keysOf(documentOf("on:\n  push:\n").root)).toStrictEqual(["on"]);
  });
});

describe("lineOf", () => {
  it("counts the line the node starts on", () => {
    const document = documentOf("name: CI\njobs:\n  build: {}\n");

    expect(lineOf(document, entryOf(document.root, "jobs")?.key)).toBe(2);
  });

  it("falls back to the first line for a node that carries no position", () => {
    expect(lineOf(documentOf("name: CI\n"), null)).toBe(1);
  });
});

describe("entriesOf", () => {
  it("lists the entries of a mapping", () => {
    expect(entriesOf(documentOf("name: CI\njobs: {}\n").root).length).toBe(2);
  });

  it("treats anything that is not a mapping as having no entries", () => {
    expect(entriesOf(documentOf("- one\n").root)).toStrictEqual([]);
  });
});

describe("itemsOf", () => {
  it("lists the items of a sequence", () => {
    expect(itemsOf(documentOf("- one\n- two\n").root).length).toBe(2);
  });

  it("treats anything that is not a sequence as having no items", () => {
    expect(itemsOf(documentOf("name: CI\n").root)).toStrictEqual([]);
  });
});

describe("keyOf", () => {
  it("spells out the key of an entry", () => {
    expect(entriesOf(documentOf("name: CI\n").root).map(keyOf)).toStrictEqual(["name"]);
  });

  it("has no name for an entry whose key is not a plain value", () => {
    expect(entriesOf(documentOf("? [one]\n: two\n").root).map(keyOf)).toStrictEqual([null]);
  });
});

describe("keysOf", () => {
  it("drops the entries whose key is not a plain value", () => {
    expect(keysOf(documentOf("name: CI\n? [one]\n: two\n").root)).toStrictEqual(["name"]);
  });
});

describe("entryOf", () => {
  it("finds the entry declared under the name", () => {
    expect(scalarText(entryOf(documentOf("name: CI\njobs: {}\n").root, "jobs")?.key)).toBe("jobs");
  });

  it("finds nothing when the name is not declared", () => {
    expect(entryOf(documentOf("name: CI\n").root, "jobs")).toBeNull();
  });
});

describe("valueOf", () => {
  it("reads the value declared under the name", () => {
    expect(scalarText(valueOf(documentOf("name: CI\n").root, "name"))).toBe("CI");
  });

  it("reads nothing when the name is written without a value at all", () => {
    expect(valueOf(documentOf("{ on }\n").root, "on")).toBeNull();
  });

  it("reads nothing when the name is not declared", () => {
    expect(valueOf(documentOf("name: CI\n").root, "jobs")).toBeNull();
  });
});

describe("scalarText", () => {
  it("reads a plain string value", () => {
    expect(scalarText(valueOf(documentOf("run: vp run guard\n").root, "run"))).toBe("vp run guard");
  });

  it("reads nothing from a value that is not a string", () => {
    expect(scalarText(valueOf(documentOf("run: 7\n").root, "run"))).toBeNull();
  });

  it("reads nothing from a value that is not a plain value at all", () => {
    expect(scalarText(valueOf(documentOf("run:\n  shell: bash\n").root, "run"))).toBeNull();
  });
});

describe("isTruthyScalar", () => {
  it("recognises a value declared as true", () => {
    expect(
      isTruthyScalar(valueOf(documentOf("continue-on-error: true\n").root, "continue-on-error")),
    ).toBe(true);
  });

  it("does not recognise a value declared as false", () => {
    expect(
      isTruthyScalar(valueOf(documentOf("continue-on-error: false\n").root, "continue-on-error")),
    ).toBe(false);
  });

  it("does not recognise a value that is not a plain value", () => {
    expect(
      isTruthyScalar(valueOf(documentOf("continue-on-error: [true]\n").root, "continue-on-error")),
    ).toBe(false);
  });
});
