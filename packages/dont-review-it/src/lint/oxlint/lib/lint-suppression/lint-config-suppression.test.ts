import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { ignoreEntriesIn, lintBlockOf, weakenedTargetRulesIn } from "./lint-config-suppression.ts";

import type { ESTree } from "@oxlint/plugins";

const TARGET_RULES = ["no-duplicate-exported-type--reuse-authoritative-type"];

const TARGET_KEY = "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type";

describe("lintBlockOf", () => {
  describe("a lint block written inline", () => {
    const it = test.extend("lintBlockOfAnInlineLintBlock", () =>
      lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default { lint: { rules: {} } };",
        ).program.body.map((statement) => statement as ESTree.Statement),
      }));

    it("is the block that is read", ({ lintBlockOfAnInlineLintBlock }) => {
      expect(lintBlockOfAnInlineLintBlock).toMatchInlineSnapshot(`
        {
          "end": 36,
          "properties": [
            {
              "computed": false,
              "end": 34,
              "key": {
                "decorators": [],
                "end": 30,
                "name": "rules",
                "optional": false,
                "start": 25,
                "type": "Identifier",
                "typeAnnotation": null,
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 25,
              "type": "Property",
              "value": {
                "end": 34,
                "properties": [],
                "start": 32,
                "type": "ObjectExpression",
              },
            },
          ],
          "start": 23,
          "type": "ObjectExpression",
        }
      `);
    });
  });

  describe("a lint block wrapped in a call", () => {
    const it = test.extend("lintBlockOfALintBlockInsideACall", () =>
      lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default { lint: withGitExcludes({ rules: {} }) };",
        ).program.body.map((statement) => statement as ESTree.Statement),
      }));

    it("is read through that call", ({ lintBlockOfALintBlockInsideACall }) => {
      expect(lintBlockOfALintBlockInsideACall).toMatchInlineSnapshot(`
        {
          "end": 52,
          "properties": [
            {
              "computed": false,
              "end": 50,
              "key": {
                "decorators": [],
                "end": 46,
                "name": "rules",
                "optional": false,
                "start": 41,
                "type": "Identifier",
                "typeAnnotation": null,
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 41,
              "type": "Property",
              "value": {
                "end": 50,
                "properties": [],
                "start": 48,
                "type": "ObjectExpression",
              },
            },
          ],
          "start": 39,
          "type": "ObjectExpression",
        }
      `);
    });
  });

  describe("a config wrapped in a call", () => {
    const it = test.extend("lintBlockOfALintBlockInsideDefineConfig", () =>
      lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default defineConfig({ lint: { rules: {} } });",
        ).program.body.map((statement) => statement as ESTree.Statement),
      }));

    it("is read through that call too", ({ lintBlockOfALintBlockInsideDefineConfig }) => {
      expect(lintBlockOfALintBlockInsideDefineConfig).toMatchInlineSnapshot(`
        {
          "end": 49,
          "properties": [
            {
              "computed": false,
              "end": 47,
              "key": {
                "decorators": [],
                "end": 43,
                "name": "rules",
                "optional": false,
                "start": 38,
                "type": "Identifier",
                "typeAnnotation": null,
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 38,
              "type": "Property",
              "value": {
                "end": 47,
                "properties": [],
                "start": 45,
                "type": "ObjectExpression",
              },
            },
          ],
          "start": 36,
          "type": "ObjectExpression",
        }
      `);
    });
  });

  describe("a lint block reached through a named export", () => {
    const it = test.extend("lintBlockOfANamedExport", () =>
      lintBlockOf({
        body: parseSync("vite.config.ts", "export const lint = { rules: {} };").program.body.map(
          (statement) => statement as ESTree.Statement,
        ),
      }));

    it("yields nothing to read", ({ lintBlockOfANamedExport }) => {
      expect(lintBlockOfANamedExport).toBe(null);
    });
  });

  describe("a config that spells no lint key", () => {
    const it = test.extend("lintBlockOfAConfigWithoutALintKey", () =>
      lintBlockOf({
        body: parseSync("vite.config.ts", "export default { test: {} };").program.body.map(
          (statement) => statement as ESTree.Statement,
        ),
      }));

    it("yields nothing to read", ({ lintBlockOfAConfigWithoutALintKey }) => {
      expect(lintBlockOfAConfigWithoutALintKey).toBe(null);
    });
  });

  describe("a lint value declared elsewhere", () => {
    const it = test.extend("lintBlockOfALintValueDeclaredElsewhere", () =>
      lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default { lint: configuredElsewhere };",
        ).program.body.map((statement) => statement as ESTree.Statement),
      }));

    it("yields nothing to read", ({ lintBlockOfALintValueDeclaredElsewhere }) => {
      expect(lintBlockOfALintValueDeclaredElsewhere).toBe(null);
    });
  });
});

describe("weakenedTargetRulesIn", () => {
  describe("a target rule held off", () => {
    const it = test.extend("weakenedOfARuleHeldOff", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": "off" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is weakened", ({ weakenedOfARuleHeldOff }) => {
      expect(weakenedOfARuleHeldOff).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 110,
              "key": {
                "end": 103,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 34,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 34,
              "type": "Property",
              "value": {
                "end": 110,
                "raw": ""off"",
                "start": 105,
                "type": "Literal",
                "value": "off",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "off",
          },
        ]
      `);
    });
  });

  describe("a target rule held at warn", () => {
    const it = test.extend("weakenedOfARuleHeldWarn", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": "warn" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is weakened", ({ weakenedOfARuleHeldWarn }) => {
      expect(weakenedOfARuleHeldWarn).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 111,
              "key": {
                "end": 103,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 34,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 34,
              "type": "Property",
              "value": {
                "end": 111,
                "raw": ""warn"",
                "start": 105,
                "type": "Literal",
                "value": "warn",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "warn",
          },
        ]
      `);
    });
  });

  describe("a target rule held at allow", () => {
    const it = test.extend("weakenedOfARuleHeldAllow", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": "allow" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is weakened", ({ weakenedOfARuleHeldAllow }) => {
      expect(weakenedOfARuleHeldAllow).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 112,
              "key": {
                "end": 103,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 34,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 34,
              "type": "Property",
              "value": {
                "end": 112,
                "raw": ""allow"",
                "start": 105,
                "type": "Literal",
                "value": "allow",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "allow",
          },
        ]
      `);
    });
  });

  describe("a target rule held at a number below the failing one", () => {
    const it = test.extend("weakenedOfARuleHeldAtOne", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": 1 } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is weakened", ({ weakenedOfARuleHeldAtOne }) => {
      expect(weakenedOfARuleHeldAtOne).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 106,
              "key": {
                "end": 103,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 34,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 34,
              "type": "Property",
              "value": {
                "end": 106,
                "raw": "1",
                "start": 105,
                "type": "Literal",
                "value": 1,
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "1",
          },
        ]
      `);
    });
  });

  describe("a severity written first in a list", () => {
    const it = test.extend("weakenedOfARuleHeldOffThroughAList", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": ["off", "error"] } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is the one that counts", ({ weakenedOfARuleHeldOffThroughAList }) => {
      expect(weakenedOfARuleHeldOffThroughAList).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 121,
              "key": {
                "end": 103,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 34,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 34,
              "type": "Property",
              "value": {
                "elements": [
                  {
                    "end": 111,
                    "raw": ""off"",
                    "start": 106,
                    "type": "Literal",
                    "value": "off",
                  },
                  {
                    "end": 120,
                    "raw": ""error"",
                    "start": 113,
                    "type": "Literal",
                    "value": "error",
                  },
                ],
                "end": 121,
                "start": 105,
                "type": "ArrayExpression",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "off",
          },
        ]
      `);
    });
  });

  describe("a severity spelled through a named constant", () => {
    const it = test.extend("weakenedOfARuleHeldOffThroughANamedConstant", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": LINT_SEVERITY.OFF } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is read by its member name", ({ weakenedOfARuleHeldOffThroughANamedConstant }) => {
      expect(weakenedOfARuleHeldOffThroughANamedConstant).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 122,
              "key": {
                "end": 103,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 34,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 34,
              "type": "Property",
              "value": {
                "computed": false,
                "end": 122,
                "object": {
                  "decorators": [],
                  "end": 118,
                  "name": "LINT_SEVERITY",
                  "optional": false,
                  "start": 105,
                  "type": "Identifier",
                  "typeAnnotation": null,
                },
                "optional": false,
                "property": {
                  "decorators": [],
                  "end": 122,
                  "name": "OFF",
                  "optional": false,
                  "start": 119,
                  "type": "Identifier",
                  "typeAnnotation": null,
                },
                "start": 105,
                "type": "MemberExpression",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "off",
          },
        ]
      `);
    });
  });

  describe("a rules block assembled by spreading another block", () => {
    const it = test.extend("weakenedOfARulesBlockAssembledBySpreading", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { ...shared, "${TARGET_KEY}": "off" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is read for what it spells", ({ weakenedOfARulesBlockAssembledBySpreading }) => {
      expect(weakenedOfARulesBlockAssembledBySpreading).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 121,
              "key": {
                "end": 114,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 45,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 45,
              "type": "Property",
              "value": {
                "end": 121,
                "raw": ""off"",
                "start": 116,
                "type": "Literal",
                "value": "off",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "off",
          },
        ]
      `);
    });
  });

  describe("the rules an override carries", () => {
    const it = test.extend("weakenedOfARuleAnOverrideCarries", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { overrides: [{ files: ["a/**"], rules: { "${TARGET_KEY}": "off" } }] } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("are read the same way", ({ weakenedOfARuleAnOverrideCarries }) => {
      expect(weakenedOfARuleAnOverrideCarries).toMatchInlineSnapshot(`
        [
          {
            "property": {
              "computed": false,
              "end": 141,
              "key": {
                "end": 134,
                "raw": ""dont-review-it/no-duplicate-exported-type--reuse-authoritative-type"",
                "start": 65,
                "type": "Literal",
                "value": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
              },
              "kind": "init",
              "method": false,
              "optional": false,
              "shorthand": false,
              "start": 65,
              "type": "Property",
              "value": {
                "end": 141,
                "raw": ""off"",
                "start": 136,
                "type": "Literal",
                "value": "off",
              },
            },
            "ruleName": "dont-review-it/no-duplicate-exported-type--reuse-authoritative-type",
            "severity": "off",
          },
        ]
      `);
    });
  });

  describe("a target rule held at error", () => {
    const it = test.extend("weakenedOfARuleHeldError", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": "error" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is left alone", ({ weakenedOfARuleHeldError }) => {
      expect(weakenedOfARuleHeldError).toStrictEqual([]);
    });
  });

  describe("a target rule held at deny", () => {
    const it = test.extend("weakenedOfARuleHeldDeny", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": "deny" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is left alone", ({ weakenedOfARuleHeldDeny }) => {
      expect(weakenedOfARuleHeldDeny).toStrictEqual([]);
    });
  });

  describe("a target rule held at the failing number", () => {
    const it = test.extend("weakenedOfARuleHeldAtTwo", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": 2 } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is left alone", ({ weakenedOfARuleHeldAtTwo }) => {
      expect(weakenedOfARuleHeldAtTwo).toStrictEqual([]);
    });
  });

  describe("a target rule held at error through a list", () => {
    const it = test.extend("weakenedOfARuleHeldErrorThroughAList", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": ["error", { max: 1 }] } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is left alone", ({ weakenedOfARuleHeldErrorThroughAList }) => {
      expect(weakenedOfARuleHeldErrorThroughAList).toStrictEqual([]);
    });
  });

  describe("a severity spelled through the error constant", () => {
    const it = test.extend("weakenedOfARuleHeldAtTheErrorConstant", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": LINT_SEVERITY.ERROR } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is left alone", ({ weakenedOfARuleHeldAtTheErrorConstant }) => {
      expect(weakenedOfARuleHeldAtTheErrorConstant).toStrictEqual([]);
    });
  });

  describe("a severity held at a name the config does not spell out", () => {
    const it = test.extend("weakenedOfARuleHeldAtAChosenName", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": chosenSeverity } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is not read as weakened", ({ weakenedOfARuleHeldAtAChosenName }) => {
      expect(weakenedOfARuleHeldAtAChosenName).toStrictEqual([]);
    });
  });

  describe("a severity held in a spread list", () => {
    const it = test.extend("weakenedOfARuleHeldInASpreadList", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": [...spread] } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is not read as weakened", ({ weakenedOfARuleHeldInASpreadList }) => {
      expect(weakenedOfARuleHeldInASpreadList).toStrictEqual([]);
    });
  });

  describe("a severity held in an empty list", () => {
    const it = test.extend("weakenedOfARuleHeldInAnEmptyList", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": [] } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is not read as weakened", ({ weakenedOfARuleHeldInAnEmptyList }) => {
      expect(weakenedOfARuleHeldInAnEmptyList).toStrictEqual([]);
    });
  });

  describe("a rule named by a computed key", () => {
    const it = test.extend("weakenedOfARuleNamedByAComputedKey", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          'export default { lint: { rules: { [computed]: "off" } } };',
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is not read as weakened", ({ weakenedOfARuleNamedByAComputedKey }) => {
      expect(weakenedOfARuleNamedByAComputedKey).toStrictEqual([]);
    });
  });

  describe("a severity spelled as an unknown word", () => {
    const it = test.extend("weakenedOfARuleHeldAtAnUnknownSpelling", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          `export default { lint: { rules: { "${TARGET_KEY}": "chosen" } } };`,
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is not read as weakened", ({ weakenedOfARuleHeldAtAnUnknownSpelling }) => {
      expect(weakenedOfARuleHeldAtAnUnknownSpelling).toStrictEqual([]);
    });
  });

  describe("a rule outside the target set", () => {
    const it = test.extend("weakenedOfARuleOutsideTheTargetSet", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          'export default { lint: { rules: { "no-console": "off" } } };',
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("is not this rule's business", ({ weakenedOfARuleOutsideTheTargetSet }) => {
      expect(weakenedOfARuleOutsideTheTargetSet).toStrictEqual([]);
    });
  });

  describe("overrides that carry no rules", () => {
    const it = test.extend("weakenedOfOverridesThatCarryNoRules", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          'export default { lint: { overrides: [{ files: ["a/**"] }, "elsewhere", ...more] } };',
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("yield nothing", ({ weakenedOfOverridesThatCarryNoRules }) => {
      expect(weakenedOfOverridesThatCarryNoRules).toStrictEqual([]);
    });
  });

  describe("overrides declared elsewhere", () => {
    const it = test.extend("weakenedOfOverridesDeclaredElsewhere", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default { lint: { overrides: elsewhere } };",
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("yield nothing", ({ weakenedOfOverridesDeclaredElsewhere }) => {
      expect(weakenedOfOverridesDeclaredElsewhere).toStrictEqual([]);
    });
  });

  describe("a lint block without rules", () => {
    const it = test.extend("weakenedOfALintBlockWithoutRules", () => {
      const lint = lintBlockOf({
        body: parseSync("vite.config.ts", "export default { lint: { } };").program.body.map(
          (statement) => statement as ESTree.Statement,
        ),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("yields nothing", ({ weakenedOfALintBlockWithoutRules }) => {
      expect(weakenedOfALintBlockWithoutRules).toStrictEqual([]);
    });
  });

  describe("a rules block declared elsewhere", () => {
    const it = test.extend("weakenedOfARulesBlockDeclaredElsewhere", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default { lint: { rules: elsewhere } };",
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return weakenedTargetRulesIn({ lint, targetRules: TARGET_RULES });
    });

    it("yields nothing", ({ weakenedOfARulesBlockDeclaredElsewhere }) => {
      expect(weakenedOfARulesBlockDeclaredElsewhere).toStrictEqual([]);
    });
  });
});

describe("ignoreEntriesIn", () => {
  describe("two patterns the config spells out", () => {
    const it = test.extend("patternsOfTwoSpelledPatterns", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          'export default { lint: { ignorePatterns: ["dist/**", "src/legacy/**"] } };',
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return ignoreEntriesIn(lint);
    });

    it("are the ignore patterns", ({ patternsOfTwoSpelledPatterns }) => {
      expect(patternsOfTwoSpelledPatterns).toMatchInlineSnapshot(`
        [
          {
            "element": {
              "end": 51,
              "raw": ""dist/**"",
              "start": 42,
              "type": "Literal",
              "value": "dist/**",
            },
            "pattern": "dist/**",
          },
          {
            "element": {
              "end": 68,
              "raw": ""src/legacy/**"",
              "start": 53,
              "type": "Literal",
              "value": "src/legacy/**",
            },
            "pattern": "src/legacy/**",
          },
        ]
      `);
    });
  });

  describe("a list holding things that are not spellings", () => {
    const it = test.extend("patternsOfAListHoldingThingsThatAreNotSpellings", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          'export default { lint: { ignorePatterns: ["dist/**", chosen, 1, ...more] } };',
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return ignoreEntriesIn(lint);
    });

    it("carries only the spellings", ({ patternsOfAListHoldingThingsThatAreNotSpellings }) => {
      expect(patternsOfAListHoldingThingsThatAreNotSpellings).toMatchInlineSnapshot(`
        [
          {
            "element": {
              "end": 51,
              "raw": ""dist/**"",
              "start": 42,
              "type": "Literal",
              "value": "dist/**",
            },
            "pattern": "dist/**",
          },
        ]
      `);
    });
  });

  describe("ignore patterns declared elsewhere", () => {
    const it = test.extend("patternsOfIgnorePatternsDeclaredElsewhere", () => {
      const lint = lintBlockOf({
        body: parseSync(
          "vite.config.ts",
          "export default { lint: { ignorePatterns: elsewhere } };",
        ).program.body.map((statement) => statement as ESTree.Statement),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return ignoreEntriesIn(lint);
    });

    it("carry nothing", ({ patternsOfIgnorePatternsDeclaredElsewhere }) => {
      expect(patternsOfIgnorePatternsDeclaredElsewhere).toStrictEqual([]);
    });
  });

  describe("a lint block without ignore patterns", () => {
    const it = test.extend("patternsOfALintBlockWithoutIgnorePatterns", () => {
      const lint = lintBlockOf({
        body: parseSync("vite.config.ts", "export default { lint: { } };").program.body.map(
          (statement) => statement as ESTree.Statement,
        ),
      });
      if (lint === null) throw new Error("the configuration under test must hold a lint block");
      return ignoreEntriesIn(lint);
    });

    it("carries nothing", ({ patternsOfALintBlockWithoutIgnorePatterns }) => {
      expect(patternsOfALintBlockWithoutIgnorePatterns).toStrictEqual([]);
    });
  });
});
