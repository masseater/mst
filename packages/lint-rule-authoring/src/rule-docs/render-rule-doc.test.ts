import { describe, expect, test } from "vite-plus/test";

import {
  renderExamples,
  renderMessages,
  renderRuleHeader,
  renderRuntimeSelection,
} from "./render-rule-doc.ts";

const SILENT_RULE = {
  name: "no-thing--allow-it",
  description: "Disallow the thing",
  sourcePath: "src/lint/oxlint/rules/no-thing--allow-it.ts",
  fixable: false,
  hasSuggestions: false,
  configurable: false,
  shipped: true,
  bundle: null,
  messages: [],
};

const HEADER_HEAD: readonly string[] = [
  "Disallow the thing",
  "",
  "- Tool: `oxlint`",
  "- Fixable: no",
  "- Suggestions: no",
  "- Options: no",
];

const HEADER_TAIL =
  "- Source: [`no-thing--allow-it.ts`](../../src/lint/oxlint/rules/no-thing--allow-it.ts)";

describe("renderRuleHeader", () => {
  describe("a shipped rule that sits in a bundle", () => {
    const it = test.extend("rendered", () => renderRuleHeader({ ...SILENT_RULE, bundle: "core" }));

    it("names the bundle instead of saying the preset carries it", ({ rendered }) => {
      expect(rendered).toBe([...HEADER_HEAD, "- Bundle: `core`", HEADER_TAIL].join("\n"));
    });
  });

  describe("a shipped rule in a workspace that has no bundles", () => {
    const it = test.extend("rendered", () => renderRuleHeader(SILENT_RULE));

    it("says the preset carries it", ({ rendered }) => {
      expect(rendered).toBe(
        [...HEADER_HEAD, "- Shipped in the preset: yes", HEADER_TAIL].join("\n"),
      );
    });
  });

  describe("a rule the preset leaves off", () => {
    const it = test.extend("rendered", () =>
      renderRuleHeader({ ...SILENT_RULE, shipped: false, bundle: "core" }));

    it("says the preset does not carry it even though a directory names a bundle", ({
      rendered,
    }) => {
      expect(rendered).toBe(
        [...HEADER_HEAD, "- Shipped in the preset: no", HEADER_TAIL].join("\n"),
      );
    });
  });
});

describe("renderMessages", () => {
  describe("a rule that declares no message of its own", () => {
    const it = test.extend("rendered", () => renderMessages(SILENT_RULE));

    it("says what a report carries instead of printing an empty table", ({ rendered }) => {
      expect(rendered).toBe(
        "This rule declares no message of its own. A report carries the rule name alone.",
      );
    });
  });
});

describe("renderRuntimeSelection", () => {
  describe("a rule that runs in the other lint host and reads options", () => {
    const it = test.extend("rendered", () =>
      renderRuntimeSelection({
        ...SILENT_RULE,
        sourcePath: "src/lint/eslint/rules/no-thing--allow-it.ts",
        configurable: true,
      }));

    it("names that host and says the options are read from the source", ({ rendered }) => {
      expect(rendered).toBe(
        "This rule runs as an ESLint plugin rule. It reads options declared on `meta.schema` in the source linked above.",
      );
    });
  });
});

describe("renderRuntimeSelection of a rule the analyser hosts", () => {
  describe("a rule that reads no option", () => {
    const it = test.extend("rendered", () => renderRuntimeSelection(SILENT_RULE));

    it("names that host and says the consumer turns it on as a whole", ({ rendered }) => {
      expect(rendered).toBe(
        "This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.",
      );
    });
  });
});

describe("renderExamples", () => {
  describe("examples on both sides, one of them naming the file it stands in", () => {
    const it = test.extend("rendered", () =>
      renderExamples({
        valid: [
          {
            name: "a value the rule leaves alone",
            code: "export const shipped = true;",
            filename: "src/shipped.ts",
          },
        ],
        invalid: [
          { name: "a value the rule rejects", code: "export default true;", filename: null },
        ],
        unspellable: [],
      }));

    it("puts the rejected side first and carries the file name into its block", ({ rendered }) => {
      expect(rendered).toBe(
        [
          "Code this rule rejects.",
          "",
          "```ts",
          "// a value the rule rejects",
          "export default true;",
          "```",
          "",
          "Code this rule accepts.",
          "",
          "```ts",
          "// a value the rule leaves alone",
          "// in src/shipped.ts",
          "export const shipped = true;",
          "```",
        ].join("\n"),
      );
    });
  });
});
