import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { disabledRuleDeclarationsIn } from "./disabled-rule-declarations.ts";

describe("disabledRuleDeclarationsIn", () => {
  describe("an override that names two paths and switches a preset rule off", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: dontReviewItPreset.lint({
    overrides: [
      {
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: { "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off" },
      },
    ],
  }),
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("finds a preset rule switched off for the paths an override names", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-handmade-standard-io-double--use-standard-io-test",
          line: 6,
          filePatterns: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        },
      ]);
    });
  });

  describe("a rule switched off at the root of the lint block", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("leaves a rule switched off everywhere without any path to narrow it", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
          line: 2,
          filePatterns: [],
        },
      ]);
    });
  });

  describe("a preset rule the configuration switches on", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "error" } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a rule the configuration switches on", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a rule of another plugin switched off", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "vitest/consistent-test-filename": "off" } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a rule that belongs to another plugin", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a preset rule whose severity is written as a tuple", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": ["off", {}] } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("reads the severity from the head of a tuple", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
          line: 2,
          filePatterns: [],
        },
      ]);
    });
  });

  describe("a preset rule switched off through a named severity constant", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("reads the member name of a named severity constant", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
          line: 2,
          filePatterns: [],
        },
      ]);
    });
  });

  describe("a named severity constant that switches a preset rule on", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.ERROR } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a named constant that names a severity other than off", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a severity whose member is computed at run time", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY[level] } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a severity whose member name is computed at run time", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a severity handed over as an identifier", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": severity } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a severity that names neither a value nor a member", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a rule entry whose key is computed at run time", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { rules: { [ruleId]: "off" } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a rule whose name is computed at run time", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a lint block whose rules field is spelled as a string literal", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: { "rules": { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("reads the identifier form of a field name", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
          line: 2,
          filePatterns: [],
        },
      ]);
    });
  });

  describe("a configuration bound to a named export", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export const config = { lint: {} };`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a configuration that exports nothing by default", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a lint block handed over as an identifier", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({ lint: sharedLint });`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about a lint block that is not written as a literal", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("an override list handed over as an identifier", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({ lint: { overrides: sharedOverrides } });`,
        config: defaultPresetAdoptionConfig,
      }));

    it("says nothing about an override list that is not written as a literal", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("an override whose files field is handed over as an identifier", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: {
    overrides: [
      { files: sharedFiles, rules: { "dont-review-it/no-promise-chain--use-async-await": "off" } },
    ],
  },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("keeps the paths of an override that spells them outside a list as empty", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-promise-chain--use-async-await",
          line: 4,
          filePatterns: [],
        },
      ]);
    });
  });

  describe("an override whose files list mixes a literal and an identifier", () => {
    const it = test.extend("declarations", () =>
      disabledRuleDeclarationsIn({
        source: `export default defineConfig({
  lint: {
    overrides: [
      {
        files: ["packages/web/**", pattern],
        rules: { "dont-review-it/no-promise-chain--use-async-await": "off" },
      },
    ],
  },
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("drops a path that is not spelled as a plain value", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        {
          ruleId: "dont-review-it/no-promise-chain--use-async-await",
          line: 6,
          filePatterns: ["packages/web/**"],
        },
      ]);
    });
  });
});
