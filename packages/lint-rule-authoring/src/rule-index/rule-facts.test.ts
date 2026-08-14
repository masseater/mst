import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { lintRuleFactsIn } from "./rule-facts.ts";

describe("lintRuleFactsIn", () => {
  describe("a factory call carrying name, description, options, and notices", () => {
    const it = test.extend("facts", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/full.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `import { createRule } from "./create-rule.ts";
export const full = createRule({
  name: "no-full--stop-doing-it",
  meta: {
    type: "problem",
    docs: { description: "Disallow the thing" },
    messages: { report: "The thing must not be done. Stop." },
    schema: [{ type: "object" }],
    fixable: "code",
    hasSuggestions: true,
  },
  create: () => ({}),
});
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it("is read in full", ({ facts }) => {
      expect(facts).toStrictEqual([
        {
          name: "no-full--stop-doing-it",
          description: "Disallow the thing",
          sourcePath: "src/rules/full.ts",
          fixable: true,
          hasSuggestions: true,
          configurable: true,
          shipped: true,
          messages: [{ messageId: "report", template: "The thing must not be done. Stop." }],
        },
      ]);
    });
  });

  describe("a rule spelled as a bare object", () => {
    const it = test.extend("facts", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/bare.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const bare = {
  name: "no-bare--wrap-it",
  meta: {
    docs: { description: "Disallow bare spelling" },
    messages: { report: "It is forbidden." },
    schema: [],
    hasSuggestions: false,
  },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it("is read the same way as a factory call", ({ facts }) => {
      expect(facts).toStrictEqual([
        {
          name: "no-bare--wrap-it",
          description: "Disallow bare spelling",
          sourcePath: "src/rules/bare.ts",
          fixable: false,
          hasSuggestions: false,
          configurable: false,
          shipped: true,
          messages: [{ messageId: "report", template: "It is forbidden." }],
        },
      ]);
    });
  });

  describe("a rule handed out by an arrow creator", () => {
    const it = test.extend("ruleNamesFromArrowCreator", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/created.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `import { createRule } from "./create-rule.ts";
export const createRuleWithDeps = ({ load }: { load: () => void }) =>
  createRule({
    name: "no-created--inline-it",
    meta: { docs: { description: "Disallow creation" }, messages: { report: "No." } },
    create: () => ({}),
  });
export const makeNothing = () => {
  return {};
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("is still found", ({ ruleNamesFromArrowCreator }) => {
      expect(ruleNamesFromArrowCreator).toStrictEqual(["no-created--inline-it"]);
    });
  });

  describe("a description assembled from pieces", () => {
    const it = test.extend("descriptions", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/assembled.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `const TAIL = " and never let it back" + ".";
export const assembled = {
  name: "no-assembled--flatten-it",
  meta: {
    docs: { description: "Disallow the part" + TAIL },
    messages: { report: \`It is forbidden.\` },
  },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.description);
    });

    it("is resolved before it is read", ({ descriptions }) => {
      expect(descriptions).toStrictEqual(["Disallow the part and never let it back."]);
    });
  });

  describe("a description written as a plain template", () => {
    const it = test.extend("descriptions", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/templated.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const templated = {
  name: "no-templated--spell-it-out",
  meta: { docs: { description: \`Disallow templates\` }, messages: { report: "No." } },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.description);
    });

    it("keeps its text", ({ descriptions }) => {
      expect(descriptions).toStrictEqual(["Disallow templates"]);
    });
  });

  describe("descriptions the source does not spell statically", () => {
    const it = test.extend("descriptions", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/opaque.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `import { described } from "./elsewhere.ts";
const spun = "a" + described;
const loops = other;
const other = loops;
export const computed = {
  name: "no-computed--write-it-down",
  meta: { docs: { description: describe() }, messages: { report: "No." } },
  create: () => ({}),
};
export const imported = {
  name: "no-imported--own-it",
  meta: { docs: { description: described }, messages: { report: "No." } },
  create: () => ({}),
};
export const numbered = {
  name: "no-numbered--name-it",
  meta: { docs: { description: 7 }, messages: { report: "No." } },
  create: () => ({}),
};
export const interpolated = {
  name: "no-interpolated--freeze-it",
  meta: { docs: { description: \`grows \${spun}\` }, messages: { report: "No." } },
  create: () => ({}),
};
export const circular = {
  name: "no-circular--break-it",
  meta: { docs: { description: loops }, messages: { report: "No." } },
  create: () => ({}),
};
export const headless = {
  name: "no-headless--anchor-it",
  meta: { docs: { description: describe() + " tail" }, messages: { report: "No." } },
  create: () => ({}),
};
export const tailless = {
  name: "no-tailless--anchor-it",
  meta: { docs: { description: "head " + describe() }, messages: { report: "No." } },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.description);
    });

    it("fall back to silence", ({ descriptions }) => {
      expect(descriptions).toStrictEqual(["", "", "", "", "", "", ""]);
    });
  });

  describe("a rule without a name", () => {
    const it = test.extend("ruleNamesFromUnnamedRule", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/named-after-file.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const anonymous = {
  meta: { docs: { description: "Disallow anonymity" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("is called after its file", ({ ruleNamesFromUnnamedRule }) => {
      expect(ruleNamesFromUnnamedRule).toStrictEqual(["named-after-file"]);
    });
  });

  describe("a rule in a file with a generic stem", () => {
    const it = test.extend("ruleNamesFromIndexFile", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/no-generic--house-it/index.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const generic = {
  meta: { docs: { description: "Disallow generic stems" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("is called after its directory", ({ ruleNamesFromIndexFile }) => {
      expect(ruleNamesFromIndexFile).toStrictEqual(["no-generic--house-it"]);
    });
  });

  describe("a name the source does not spell statically", () => {
    const it = test.extend("ruleNamesFromDynamicName", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/fallback.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const dynamic = {
  name: pickName(),
  meta: { docs: { description: "Disallow dynamic names" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("falls back to the file", ({ ruleNamesFromDynamicName }) => {
      expect(ruleNamesFromDynamicName).toStrictEqual(["fallback"]);
    });
  });

  describe("a name spelled with a quoted key", () => {
    const it = test.extend("ruleNamesFromQuotedKey", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/quoted.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const quoted = {
  "name": "no-quoted--unquote-it",
  meta: {
    1: "stray",
    docs: { description: "Disallow quoted keys" },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("is still a name", ({ ruleNamesFromQuotedKey }) => {
      expect(ruleNamesFromQuotedKey).toStrictEqual(["no-quoted--unquote-it"]);
    });
  });

  describe("a file whose exports mostly define no rule", () => {
    const it = test.extend("ruleNamesFromMixedExports", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/mixed.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `import { base, otherMeta, sharedMessages } from "./shared.ts";
export type Shape = { readonly name: string };
export const budget = 42;
export const settings = { level: "high" };
export const detached = { meta: otherMeta, create: () => ({}) };
export const borrowed = { meta: { docs: {}, messages: sharedMessages }, create: () => ({}) };
export const undocumented = { meta: { messages: { report: "No." } }, create: () => ({}) };
export const spread = { ...base, meta: { docs: { description: "kept" }, messages: { report: "No." } } };
export const called = pickRule("no-object-argument");
export function helper(): void {}
export { budget as sharedBudget };
let uninitialised;
const [first] = [1];
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("passes over the exports that define no rule", ({ ruleNamesFromMixedExports }) => {
      expect(ruleNamesFromMixedExports).toStrictEqual(["mixed", "mixed"]);
    });
  });

  describe("a docs field that is not an object literal", () => {
    const it = test.extend("facts", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/borrowed-docs.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `import { docsElsewhere, schemaElsewhere } from "./shared.ts";
export const borrowedDocs = {
  name: "no-borrowed-docs--inline-them",
  meta: { docs: docsElsewhere, messages: { report: "No." }, schema: schemaElsewhere },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it("reads as no description, and a schema it cannot open still declares options", ({
      facts,
    }) => {
      expect(facts).toStrictEqual([
        {
          name: "no-borrowed-docs--inline-them",
          description: "",
          sourcePath: "src/rules/borrowed-docs.ts",
          fixable: false,
          hasSuggestions: false,
          configurable: true,
          shipped: true,
          messages: [{ messageId: "report", template: "No." }],
        },
      ]);
    });
  });

  describe("a schema named by a constant of the same file", () => {
    const it = test.extend("facts", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/named-schema.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `const EMPTY_SCHEMA = [];
export const namedSchema = {
  name: "no-named-schema--read-it",
  meta: { messages: { report: "No." }, schema: EMPTY_SCHEMA },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it("takes the constant it names as the schema it declares", ({ facts }) => {
      expect(facts).toStrictEqual([
        {
          name: "no-named-schema--read-it",
          description: "",
          sourcePath: "src/rules/named-schema.ts",
          fixable: false,
          hasSuggestions: false,
          configurable: false,
          shipped: true,
          messages: [{ messageId: "report", template: "No." }],
        },
      ]);
    });
  });

  describe("rules that say whether the shipped preset carries them", () => {
    const it = test.extend("shippedFlags", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/delivery.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const withheld = {
  name: "no-withheld--name-it-yourself",
  meta: {
    docs: { description: "Disallow withholding", shipped: false },
    messages: { report: "No." },
  },
  create: () => ({}),
};
export const declared = {
  name: "no-declared--keep-it",
  meta: {
    docs: { description: "Disallow declaring", shipped: true },
    messages: { report: "No." },
  },
  create: () => ({}),
};
export const silent = {
  name: "no-silent--keep-it",
  meta: { docs: { description: "Disallow silence" }, messages: { report: "No." } },
  create: () => ({}),
};
export const opaque = {
  name: "no-opaque--spell-it-out",
  meta: {
    docs: { description: "Disallow opacity", shipped: decide() },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.shipped);
    });

    it("counts as withheld only the one that spells the refusal out", ({ shippedFlags }) => {
      expect(shippedFlags).toStrictEqual([false, true, true, true]);
    });
  });

  describe("a file exporting more than one rule", () => {
    const it = test.extend("ruleNamesFromPairedExports", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const sourcePath = "src/rules/pair.ts";
      mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
      writeFileSync(
        join(root, sourcePath),
        `export const first = {
  name: "no-first--merge-them",
  meta: { docs: { description: "Disallow firsts" }, messages: { report: "No." } },
  create: () => ({}),
};
export const second = {
  name: "no-second--merge-them",
  meta: { docs: { description: "Disallow seconds" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
        "utf8",
      );
      return lintRuleFactsIn({ workspaceRoot: root, sourcePath }).map((rule) => rule.name);
    });

    it("makes every rule it exports appear once", ({ ruleNamesFromPairedExports }) => {
      expect(ruleNamesFromPairedExports).toStrictEqual([
        "no-first--merge-them",
        "no-second--merge-them",
      ]);
    });
  });
});
