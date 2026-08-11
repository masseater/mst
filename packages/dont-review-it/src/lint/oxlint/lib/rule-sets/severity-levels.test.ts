import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { rankOfLevel, severityLevelOf, strongestLevelAmong } from "./severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

const levelOf = (written: string): string | null => {
  const [statement] = parseSync("severity.ts", `const severity = ${written};`).program.body;
  const declared = statement as ESTree.Statement;
  if (declared.type !== "VariableDeclaration") throw new Error(`no declaration in ${written}`);
  const spelled = declared.declarations[0]?.init;
  if (spelled === undefined || spelled === null) throw new Error(`no severity in ${written}`);
  return severityLevelOf(spelled);
};

describe("severity-levels", () => {
  test("the spellings a run fails on land on the error level", () => {
    expect(levelOf(`"error"`)).toBe("error");
    expect(levelOf(`"deny"`)).toBe("error");
    expect(levelOf("2")).toBe("error");
    expect(levelOf(`["error", { max: 1 }]`)).toBe("error");
    expect(levelOf("LINT_SEVERITY.ERROR")).toBe("error");
  });

  test("the spellings a run passes on land on the warn and off levels", () => {
    expect(levelOf(`"warn"`)).toBe("warn");
    expect(levelOf("1")).toBe("warn");
    expect(levelOf(`"off"`)).toBe("off");
    expect(levelOf(`"allow"`)).toBe("off");
    expect(levelOf("0")).toBe("off");
  });

  test("a severity this reader cannot resolve has no level", () => {
    expect(levelOf("chosenSeverity")).toBeNull();
    expect(levelOf(`"quiet"`)).toBeNull();
    expect(levelOf("3")).toBeNull();
    expect(levelOf("[]")).toBeNull();
  });

  test("the levels rank from silent to failing", () => {
    expect(rankOfLevel("off")).toBe(0);
    expect(rankOfLevel("warn")).toBe(1);
    expect(rankOfLevel("error")).toBe(2);
    expect(rankOfLevel("chosen")).toBe(0);
  });

  test("the strongest level among the ones a block spells is the one the set is held at", () => {
    expect(strongestLevelAmong(["off", "error", "warn"])).toBe("error");
    expect(strongestLevelAmong(["off", "warn"])).toBe("warn");
    expect(strongestLevelAmong(["off"])).toBe("off");
    expect(strongestLevelAmong([])).toBe("off");
  });
});
