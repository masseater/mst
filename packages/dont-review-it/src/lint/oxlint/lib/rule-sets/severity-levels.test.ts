import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { rankOfLevel, severityLevelOf, strongestLevelAmong } from "./severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

describe("severityLevelOf", () => {
  describe("the word a run fails on", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = "error";`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the error level", ({ levels }) => {
      expect(levels).toStrictEqual(["error"]);
    });
  });

  describe("the word a run denies on", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = "deny";`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the error level", ({ levels }) => {
      expect(levels).toStrictEqual(["error"]);
    });
  });

  describe("the loudest digit", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = 2;")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the error level", ({ levels }) => {
      expect(levels).toStrictEqual(["error"]);
    });
  });

  describe("a list opened by the failing word", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = ["error", { max: 1 }];`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the error level", ({ levels }) => {
      expect(levels).toStrictEqual(["error"]);
    });
  });

  describe("a named constant spelling the loudest", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = LINT_SEVERITY.ERROR;")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the error level", ({ levels }) => {
      expect(levels).toStrictEqual(["error"]);
    });
  });

  describe("the word a run warns on", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = "warn";`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the warn level", ({ levels }) => {
      expect(levels).toStrictEqual(["warn"]);
    });
  });

  describe("the warning digit", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = 1;")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the warn level", ({ levels }) => {
      expect(levels).toStrictEqual(["warn"]);
    });
  });

  describe("the word a run stays silent on", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = "off";`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the off level", ({ levels }) => {
      expect(levels).toStrictEqual(["off"]);
    });
  });

  describe("the word a run allows", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = "allow";`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the off level", ({ levels }) => {
      expect(levels).toStrictEqual(["off"]);
    });
  });

  describe("the silent digit", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = 0;")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("lands on the off level", ({ levels }) => {
      expect(levels).toStrictEqual(["off"]);
    });
  });

  describe("a name this reader cannot resolve", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = chosenSeverity;")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("has no level", ({ levels }) => {
      expect(levels).toStrictEqual([null]);
    });
  });

  describe("a word outside the vocabulary", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", `const severity = "quiet";`)
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("has no level", ({ levels }) => {
      expect(levels).toStrictEqual([null]);
    });
  });

  describe("a digit outside the vocabulary", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = 3;")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("has no level", ({ levels }) => {
      expect(levels).toStrictEqual([null]);
    });
  });

  describe("an empty list", () => {
    const it = test.extend("levels", () =>
      parseSync("severity.ts", "const severity = [];")
        .program.body.map((topLevelStatement) => topLevelStatement as ESTree.Statement)
        .flatMap((declared) =>
          declared.type === "VariableDeclaration" ? declared.declarations : [],
        )
        .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
        .map((spelled) => severityLevelOf(spelled)));

    it("has no level", ({ levels }) => {
      expect(levels).toStrictEqual([null]);
    });
  });
});

describe("rankOfLevel", () => {
  describe("the silent level", () => {
    const it = test.extend("rank", () => rankOfLevel("off"));

    it("ranks at the bottom", ({ rank }) => {
      expect(rank).toBe(0);
    });
  });

  describe("the warning level", () => {
    const it = test.extend("rank", () => rankOfLevel("warn"));

    it("ranks above the silent one", ({ rank }) => {
      expect(rank).toBe(1);
    });
  });

  describe("the failing level", () => {
    const it = test.extend("rank", () => rankOfLevel("error"));

    it("ranks above the warning one", ({ rank }) => {
      expect(rank).toBe(2);
    });
  });

  describe("a level outside the vocabulary", () => {
    const it = test.extend("rank", () => rankOfLevel("chosen"));

    it("ranks at the bottom", ({ rank }) => {
      expect(rank).toBe(0);
    });
  });
});

describe("strongestLevelAmong", () => {
  describe("a block spelling the silent, the failing, and the warning level", () => {
    const it = test.extend("strongestLevels", () =>
      [["off", "error", "warn"]].map((levels) => strongestLevelAmong(levels)));

    it("holds the failing level as the strongest one", ({ strongestLevels }) => {
      expect(strongestLevels).toStrictEqual(["error"]);
    });
  });

  describe("a block spelling the silent and the warning level", () => {
    const it = test.extend("strongestLevels", () =>
      [["off", "warn"]].map((levels) => strongestLevelAmong(levels)));

    it("holds the warning level as the strongest one when nothing fails", ({ strongestLevels }) => {
      expect(strongestLevels).toStrictEqual(["warn"]);
    });
  });

  describe("a block spelling the silent level alone", () => {
    const it = test.extend("strongestLevels", () =>
      [["off"]].map((levels) => strongestLevelAmong(levels)));

    it("holds the silent level as the strongest one", ({ strongestLevels }) => {
      expect(strongestLevels).toStrictEqual(["off"]);
    });
  });

  describe("a block spelling no level at all", () => {
    const it = test.extend("strongestLevels", () =>
      [[]].map((levels: readonly string[]) => strongestLevelAmong(levels)));

    it("is held at the silent one", ({ strongestLevels }) => {
      expect(strongestLevels).toStrictEqual(["off"]);
    });
  });
});
