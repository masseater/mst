import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { objectValueOf } from "../object-literal.ts";
import { configuredRuleBlockOf, ruleBlockObjectOf } from "./configured-rule-blocks.ts";

import type { ESTree } from "@oxlint/plugins";

describe("ruleBlockObjectOf", () => {
  describe("a configuration carrying coverage instead of rules", () => {
    const it = test.extend("rulesObject", () => {
      const statement = parseSync("config.ts", `const config = { test: { coverage: {} } };`).program
        .body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      return ruleBlockObjectOf(object);
    });

    it("holds no rules object", ({ rulesObject }) => {
      expect(rulesObject).toBe(null);
    });
  });

  describe("a configuration naming rules it keeps elsewhere", () => {
    const it = test.extend("rulesObject", () => {
      const statement = parseSync("config.ts", `const config = { rules: elsewhere };`).program
        .body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      return ruleBlockObjectOf(object);
    });

    it("holds no rules object", ({ rulesObject }) => {
      expect(rulesObject).toBe(null);
    });
  });
});

describe("configuredRuleBlockOf", () => {
  describe("a rules object spelling three severities", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { rules: { "a": "error", "b": ["warn", {}], "c": 0 } };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("comes out with the level each rule sits at", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "a", raw: '"a"', start: 26, end: 29 },
              value: { type: "Literal", value: "error", raw: '"error"', start: 31, end: 38 },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 26,
              end: 38,
            },
            ruleName: "a",
            level: "error",
          },
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "b", raw: '"b"', start: 40, end: 43 },
              value: {
                type: "ArrayExpression",
                elements: [
                  { type: "Literal", value: "warn", raw: '"warn"', start: 46, end: 52 },
                  { type: "ObjectExpression", properties: [], start: 54, end: 56 },
                ],
                start: 45,
                end: 57,
              },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 40,
              end: 57,
            },
            ruleName: "b",
            level: "warn",
          },
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "c", raw: '"c"', start: 59, end: 62 },
              value: { type: "Literal", value: 0, raw: "0", start: 64, end: 65 },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 59,
              end: 65,
            },
            ruleName: "c",
            level: "off",
          },
        ],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a rule whose severity this reader cannot resolve", () => {
    const it = test.extend("block", () => {
      const statement = parseSync("config.ts", `const config = { rules: { "a": chosenSeverity } };`)
        .program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("keeps no level", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "a", raw: '"a"', start: 26, end: 29 },
              value: {
                type: "Identifier",
                decorators: [],
                name: "chosenSeverity",
                optional: false,
                typeAnnotation: null,
                start: 31,
                end: 45,
              },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 26,
              end: 45,
            },
            ruleName: "a",
            level: null,
          },
        ],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("keys assembled while the run starts", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { rules: { [computed]: "error", ...shared } };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("name no rule this reader can hold", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration naming no files", () => {
    const it = test.extend("block", () => {
      const statement = parseSync("config.ts", `const config = { rules: {} };`).program
        .body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("covers the whole run", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration naming two paths", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { files: ["apps/site/**", "packages/cart/**"], rules: {} };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("carries the paths it covers", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: ["apps/site/**", "packages/cart/**"],
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration naming paths it keeps elsewhere", () => {
    const it = test.extend("block", () => {
      const statement = parseSync("config.ts", `const config = { files: chosenPaths, rules: {} };`)
        .program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("holds no path in the scope it covers", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration listing paths this reader cannot spell", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { files: [chosenPath, 1], rules: {} };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("holds no path in the scope it covers", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration turning type awareness on", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { options: { typeAware: true }, rules: {} };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("declares it for its own block", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: true,
      });
    });
  });

  describe("a configuration leaving type awareness unspelled", () => {
    const it = test.extend("block", () => {
      const statement = parseSync("config.ts", `const config = { rules: {} };`).program
        .body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("declares none", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration turning type awareness off", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { options: { typeAware: false }, rules: {} };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("declares none", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration keeping its options elsewhere", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { options: chosenOptions, rules: {} };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const rules = ruleBlockObjectOf(object);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object, rules, ancestors: [] });
    });

    it("declares none", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("an override read under the configuration around it", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { options: { typeAware: true }, overrides: [{ files: [], rules: {} }] };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const overrides = objectValueOf({ object, key: "overrides" });
      const [element] = overrides?.type === "ArrayExpression" ? overrides.elements : [];
      if (element?.type !== "ObjectExpression") throw new Error("no override object was written");
      const rules = ruleBlockObjectOf(element);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object: element, rules, ancestors: [object] });
    });

    it("takes the type awareness that configuration declares", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: true,
      });
    });
  });

  describe("an override read on its own", () => {
    const it = test.extend("block", () => {
      const statement = parseSync(
        "config.ts",
        `const config = { options: { typeAware: true }, overrides: [{ files: [], rules: {} }] };`,
      ).program.body[0] as ESTree.Statement;
      if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
      const object = statement.declarations[0]?.init;
      if (object?.type !== "ObjectExpression") throw new Error("no object was written");
      const overrides = objectValueOf({ object, key: "overrides" });
      const [element] = overrides?.type === "ArrayExpression" ? overrides.elements : [];
      if (element?.type !== "ObjectExpression") throw new Error("no override object was written");
      const rules = ruleBlockObjectOf(element);
      if (rules === null) throw new Error("no rules object was written");
      return configuredRuleBlockOf({ object: element, rules, ancestors: [] });
    });

    it("declares no type awareness", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: false,
      });
    });
  });
});
