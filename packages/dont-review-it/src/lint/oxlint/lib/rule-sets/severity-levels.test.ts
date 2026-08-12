import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { rankOfLevel, severityLevelOf, strongestLevelAmong } from "./severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("levelsOfTheWordError", () =>
    parseSync("severity.ts", `const severity = "error";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)))
  .extend("levelsOfTheWordDeny", () =>
    parseSync("severity.ts", `const severity = "deny";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfTheLoudestDigit", () =>
    parseSync("severity.ts", "const severity = 2;")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfAListOpenedByTheFailingWord", () =>
    parseSync("severity.ts", `const severity = ["error", { max: 1 }];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfANamedConstantSpellingTheLoudest", () =>
    parseSync("severity.ts", "const severity = LINT_SEVERITY.ERROR;")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfTheWordWarn", () =>
    parseSync("severity.ts", `const severity = "warn";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfTheWarningDigit", () =>
    parseSync("severity.ts", "const severity = 1;")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfTheWordOff", () =>
    parseSync("severity.ts", `const severity = "off";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfTheWordAllow", () =>
    parseSync("severity.ts", `const severity = "allow";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfTheSilentDigit", () =>
    parseSync("severity.ts", "const severity = 0;")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfAName", () =>
    parseSync("severity.ts", "const severity = chosenSeverity;")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfAWordOutsideTheVocabulary", () =>
    parseSync("severity.ts", `const severity = "quiet";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfADigitOutsideTheVocabulary", () =>
    parseSync("severity.ts", "const severity = 3;")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("levelsOfAnEmptyList", () =>
    parseSync("severity.ts", "const severity = [];")
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((spelled) => severityLevelOf(spelled)),
  )
  .extend("rankOfTheSilentLevel", () => rankOfLevel("off"))
  .extend("rankOfTheWarningLevel", () => rankOfLevel("warn"))
  .extend("rankOfTheFailingLevel", () => rankOfLevel("error"))
  .extend("rankOfALevelOutsideTheVocabulary", () => rankOfLevel("chosen"))
  .extend("strongestLevelsAmongSilentFailingAndWarning", () =>
    [["off", "error", "warn"]].map((levels) => strongestLevelAmong(levels)),
  )
  .extend("strongestLevelsAmongSilentAndWarning", () =>
    [["off", "warn"]].map((levels) => strongestLevelAmong(levels)),
  )
  .extend("strongestLevelsAmongSilentAlone", () =>
    [["off"]].map((levels) => strongestLevelAmong(levels)),
  )
  .extend("strongestLevelsAmongNothing", () =>
    [[]].map((levels: readonly string[]) => strongestLevelAmong(levels)),
  );

describe("severity-levels", () => {
  it("the word a run fails on lands on the error level", ({ levelsOfTheWordError }) => {
    expect(levelsOfTheWordError).toStrictEqual(["error"]);
  });

  it("the word a run denies on lands on the error level", ({ levelsOfTheWordDeny }) => {
    expect(levelsOfTheWordDeny).toStrictEqual(["error"]);
  });

  it("the loudest digit lands on the error level", ({ levelsOfTheLoudestDigit }) => {
    expect(levelsOfTheLoudestDigit).toStrictEqual(["error"]);
  });

  it("a list opened by the failing word lands on the error level", ({
    levelsOfAListOpenedByTheFailingWord,
  }) => {
    expect(levelsOfAListOpenedByTheFailingWord).toStrictEqual(["error"]);
  });

  it("a named constant spelling the loudest lands on the error level", ({
    levelsOfANamedConstantSpellingTheLoudest,
  }) => {
    expect(levelsOfANamedConstantSpellingTheLoudest).toStrictEqual(["error"]);
  });

  it("the word a run warns on lands on the warn level", ({ levelsOfTheWordWarn }) => {
    expect(levelsOfTheWordWarn).toStrictEqual(["warn"]);
  });

  it("the warning digit lands on the warn level", ({ levelsOfTheWarningDigit }) => {
    expect(levelsOfTheWarningDigit).toStrictEqual(["warn"]);
  });

  it("the word a run stays silent on lands on the off level", ({ levelsOfTheWordOff }) => {
    expect(levelsOfTheWordOff).toStrictEqual(["off"]);
  });

  it("the word a run allows lands on the off level", ({ levelsOfTheWordAllow }) => {
    expect(levelsOfTheWordAllow).toStrictEqual(["off"]);
  });

  it("the silent digit lands on the off level", ({ levelsOfTheSilentDigit }) => {
    expect(levelsOfTheSilentDigit).toStrictEqual(["off"]);
  });

  it("a name this reader cannot resolve has no level", ({ levelsOfAName }) => {
    expect(levelsOfAName).toStrictEqual([null]);
  });

  it("a word outside the vocabulary has no level", ({ levelsOfAWordOutsideTheVocabulary }) => {
    expect(levelsOfAWordOutsideTheVocabulary).toStrictEqual([null]);
  });

  it("a digit outside the vocabulary has no level", ({ levelsOfADigitOutsideTheVocabulary }) => {
    expect(levelsOfADigitOutsideTheVocabulary).toStrictEqual([null]);
  });

  it("an empty list has no level", ({ levelsOfAnEmptyList }) => {
    expect(levelsOfAnEmptyList).toStrictEqual([null]);
  });

  it("the silent level ranks at the bottom", ({ rankOfTheSilentLevel }) => {
    expect(rankOfTheSilentLevel).toBe(0);
  });

  it("the warning level ranks above the silent one", ({ rankOfTheWarningLevel }) => {
    expect(rankOfTheWarningLevel).toBe(1);
  });

  it("the failing level ranks above the warning one", ({ rankOfTheFailingLevel }) => {
    expect(rankOfTheFailingLevel).toBe(2);
  });

  it("a level outside the vocabulary ranks at the bottom", ({
    rankOfALevelOutsideTheVocabulary,
  }) => {
    expect(rankOfALevelOutsideTheVocabulary).toBe(0);
  });

  it("the failing level is the strongest one a block spells", ({
    strongestLevelsAmongSilentFailingAndWarning,
  }) => {
    expect(strongestLevelsAmongSilentFailingAndWarning).toStrictEqual(["error"]);
  });

  it("the warning level is the strongest one when nothing fails", ({
    strongestLevelsAmongSilentAndWarning,
  }) => {
    expect(strongestLevelsAmongSilentAndWarning).toStrictEqual(["warn"]);
  });

  it("the silent level is the strongest one when nothing else is spelled", ({
    strongestLevelsAmongSilentAlone,
  }) => {
    expect(strongestLevelsAmongSilentAlone).toStrictEqual(["off"]);
  });

  it("a block spelling no level at all is held at the silent one", ({
    strongestLevelsAmongNothing,
  }) => {
    expect(strongestLevelsAmongNothing).toStrictEqual(["off"]);
  });
});
