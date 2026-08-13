import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { spelledSeverityOf } from "./spelled-lint-severity.ts";

import type { ESTree } from "@oxlint/plugins";

describe("spelledSeverityOf", () => {
  describe("a severity written as a word in lower case", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = "error";`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is read in lower case", ({ severities }) => {
      expect(severities).toStrictEqual(["error"]);
    });
  });

  describe("a severity shouted in upper case", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = "OFF";`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is read in lower case too", ({ severities }) => {
      expect(severities).toStrictEqual(["off"]);
    });
  });

  describe("a severity written as the silent digit", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = 0;`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is read as that digit", ({ severities }) => {
      expect(severities).toStrictEqual(["0"]);
    });
  });

  describe("a severity written as the loud digit", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = 2;`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is read as that digit", ({ severities }) => {
      expect(severities).toStrictEqual(["2"]);
    });
  });

  describe("a severity written as a named constant", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = LINT_SEVERITY.OFF;`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is read by its member name", ({ severities }) => {
      expect(severities).toStrictEqual(["off"]);
    });
  });

  describe("the head of a written list", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = ["warn", { max: 1 }];`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is the severity that counts", ({ severities }) => {
      expect(severities).toStrictEqual(["warn"]);
    });
  });

  describe("the head of a list of constants", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = [LINT_SEVERITY.ERROR];`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("is the severity that counts", ({ severities }) => {
      expect(severities).toStrictEqual(["error"]);
    });
  });

  describe("a name", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = chosenSeverity;`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("spells no severity", ({ severities }) => {
      expect(severities).toStrictEqual([null]);
    });
  });

  describe("a boolean", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = true;`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("spells no severity", ({ severities }) => {
      expect(severities).toStrictEqual([null]);
    });
  });

  describe("an empty list", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = [];`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("spells no severity", ({ severities }) => {
      expect(severities).toStrictEqual([null]);
    });
  });

  describe("a list opened by a spread", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = [...carried];`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("spells no severity", ({ severities }) => {
      expect(severities).toStrictEqual([null]);
    });
  });

  describe("a list opened by a hole", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = [, 1];`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("spells no severity", ({ severities }) => {
      expect(severities).toStrictEqual([null]);
    });
  });

  describe("a member reached through a computed key", () => {
    const it = test.extend("severities", () =>
      parseSync("severity.ts", `const held = carried[chosen];`)
        .program.body.map((statement) => statement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((initializer) => spelledSeverityOf(initializer)));

    it("spells no severity", ({ severities }) => {
      expect(severities).toStrictEqual([null]);
    });
  });
});
