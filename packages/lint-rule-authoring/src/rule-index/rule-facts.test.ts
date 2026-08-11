import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { lintRuleFactsIn } from "./rule-facts.ts";

const workspaceWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "rule-facts-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

const factsFrom = (sourcePath: string, sourceText: string) =>
  lintRuleFactsIn({ workspaceRoot: workspaceWith({ [sourcePath]: sourceText }), sourcePath });

describe("lintRuleFactsIn", () => {
  test("a factory call carrying name, description, options, and notices is read in full", () => {
    const facts = factsFrom(
      "src/rules/full.ts",
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
    );

    expect(facts).toStrictEqual([
      {
        name: "no-full--stop-doing-it",
        description: "Disallow the thing",
        sourcePath: "src/rules/full.ts",
        fixable: true,
        hasSuggestions: true,
        configurable: true,
      },
    ]);
  });

  test("a rule spelled as a bare object is read the same way", () => {
    const facts = factsFrom(
      "src/rules/bare.ts",
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
    );

    expect(facts).toStrictEqual([
      {
        name: "no-bare--wrap-it",
        description: "Disallow bare spelling",
        sourcePath: "src/rules/bare.ts",
        fixable: false,
        hasSuggestions: false,
        configurable: false,
      },
    ]);
  });

  test("a rule handed out by an arrow creator is still found", () => {
    const facts = factsFrom(
      "src/rules/created.ts",
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
    );

    expect(facts.map((rule) => rule.name)).toStrictEqual(["no-created--inline-it"]);
  });

  test("a description assembled from pieces is resolved before it is read", () => {
    const facts = factsFrom(
      "src/rules/assembled.ts",
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
    );

    expect(facts[0]?.description).toBe("Disallow the part and never let it back.");
  });

  test("a description written as a plain template keeps its text", () => {
    const facts = factsFrom(
      "src/rules/templated.ts",
      `export const templated = {
  name: "no-templated--spell-it-out",
  meta: { docs: { description: \`Disallow templates\` }, messages: { report: "No." } },
  create: () => ({}),
};
`,
    );

    expect(facts[0]?.description).toBe("Disallow templates");
  });

  test("a description the source does not spell statically falls back to silence", () => {
    const facts = factsFrom(
      "src/rules/opaque.ts",
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
    );

    expect(facts.map((rule) => rule.description)).toStrictEqual(["", "", "", "", "", "", ""]);
  });

  test("a rule without a name is called after its file", () => {
    const facts = factsFrom(
      "src/rules/named-after-file.ts",
      `export const anonymous = {
  meta: { docs: { description: "Disallow anonymity" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
    );

    expect(facts[0]?.name).toBe("named-after-file");
  });

  test("a rule in a file with a generic stem is called after its directory", () => {
    const facts = factsFrom(
      "src/rules/no-generic--house-it/index.ts",
      `export const generic = {
  meta: { docs: { description: "Disallow generic stems" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
    );

    expect(facts[0]?.name).toBe("no-generic--house-it");
  });

  test("a name the source does not spell statically falls back to the file", () => {
    const facts = factsFrom(
      "src/rules/fallback.ts",
      `export const dynamic = {
  name: pickName(),
  meta: { docs: { description: "Disallow dynamic names" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
    );

    expect(facts[0]?.name).toBe("fallback");
  });

  test("a name spelled with a quoted key is still a name", () => {
    const facts = factsFrom(
      "src/rules/quoted.ts",
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
    );

    expect(facts[0]?.name).toBe("no-quoted--unquote-it");
  });

  test("exports that do not define a rule are passed over", () => {
    const facts = factsFrom(
      "src/rules/mixed.ts",
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
    );

    expect(facts.map((rule) => rule.name)).toStrictEqual(["mixed", "mixed"]);
  });

  test("a docs field that is not an object literal reads as no description", () => {
    const facts = factsFrom(
      "src/rules/borrowed-docs.ts",
      `import { docsElsewhere, schemaElsewhere } from "./shared.ts";
export const borrowedDocs = {
  name: "no-borrowed-docs--inline-them",
  meta: { docs: docsElsewhere, messages: { report: "No." }, schema: schemaElsewhere },
  create: () => ({}),
};
`,
    );

    expect(facts).toStrictEqual([
      {
        name: "no-borrowed-docs--inline-them",
        description: "",
        sourcePath: "src/rules/borrowed-docs.ts",
        fixable: false,
        hasSuggestions: false,
        configurable: false,
      },
    ]);
  });

  test("every rule a file exports appears once", () => {
    const facts = factsFrom(
      "src/rules/pair.ts",
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
    );

    expect(facts.map((rule) => rule.name)).toStrictEqual([
      "no-first--merge-them",
      "no-second--merge-them",
    ]);
  });
});
