import { describe, expect, test } from "vite-plus/test";

import { carriesUndecidedTarget, invokedNamesIn, namesRunner } from "./command-lines.ts";

describe("declared-replacements/command-lines", () => {
  test("the first word of a line is the command it starts", () => {
    expect(invokedNamesIn("lerna run build")).toStrictEqual(["lerna"]);
  });

  test("a line holding nothing starts no command", () => {
    expect(invokedNamesIn("")).toStrictEqual([]);
  });

  test("a name written as an argument is not the command", () => {
    expect(invokedNamesIn("node ./node_modules/lerna/cli.js")).toStrictEqual(["node"]);
  });

  test("each side of a chain is read as its own command", () => {
    expect(invokedNamesIn("tsc && lerna run build")).toStrictEqual(["tsc", "lerna"]);
  });

  test("commands separated by a semicolon are read one by one", () => {
    expect(invokedNamesIn("tsc; lerna")).toStrictEqual(["tsc", "lerna"]);
  });

  test("commands joined by a pipe are read one by one", () => {
    expect(invokedNamesIn("cat list | lerna")).toStrictEqual(["cat", "lerna"]);
  });

  test("commands joined by an alternative are read one by one", () => {
    expect(invokedNamesIn("tsc || lerna")).toStrictEqual(["tsc", "lerna"]);
  });

  test("a command written inside brackets is read on its own", () => {
    expect(invokedNamesIn("(lerna run build)")).toStrictEqual(["lerna"]);
  });

  test("environment bindings written in front of a command are stepped over", () => {
    expect(invokedNamesIn("NODE_ENV=test CI=1 lerna run build")).toStrictEqual(["lerna"]);
  });

  test("a runner written in front of a command hands the position to what it runs", () => {
    expect(invokedNamesIn("npx lerna run build")).toStrictEqual(["lerna"]);
  });

  test("a runner written as two words hands the position to what it runs", () => {
    expect(invokedNamesIn("pnpm dlx lerna")).toStrictEqual(["lerna"]);
  });

  test("flags written behind a runner are stepped over", () => {
    expect(invokedNamesIn("npx --yes -- lerna")).toStrictEqual(["lerna"]);
  });

  test("a version written on a runner argument is dropped", () => {
    expect(invokedNamesIn("npx lerna@8.0.0 run build")).toStrictEqual(["lerna"]);
  });

  test("a scoped name keeps its scope when its version is dropped", () => {
    expect(invokedNamesIn("npx @scope/lerna@8.0.0")).toStrictEqual(["@scope/lerna"]);
  });

  test("a scoped name written without a version stands as it is", () => {
    expect(invokedNamesIn("npx @scope/lerna")).toStrictEqual(["@scope/lerna"]);
  });

  test("a shell handed an inline script hands the position to what the script starts", () => {
    expect(invokedNamesIn('bash -c "lerna run build"')).toStrictEqual(["lerna"]);
  });

  test("a shell handed a script file starts the shell", () => {
    expect(invokedNamesIn("bash scripts/release.sh")).toStrictEqual(["bash"]);
  });

  test("the elements of a fetched address are read one by one", () => {
    expect(invokedNamesIn("curl https://example.com/lerna/install.sh")).toStrictEqual([
      "curl",
      "https:",
      "example.com",
      "lerna",
      "install.sh",
    ]);
  });

  test("a command settled by a substitution names nothing", () => {
    expect(invokedNamesIn("$TOOL run build")).toStrictEqual([]);
  });

  test("a line spelling out its command settles what it starts", () => {
    expect(carriesUndecidedTarget("lerna run build")).toBe(false);
  });

  test("a line holding nothing settles what it starts", () => {
    expect(carriesUndecidedTarget("")).toBe(false);
  });

  test("a command settled by a substitution leaves the target undecided", () => {
    expect(carriesUndecidedTarget("$TOOL run build")).toBe(true);
  });

  test("fetched text handed to a shell leaves the target undecided", () => {
    expect(carriesUndecidedTarget("curl https://example.com/install.sh | bash")).toBe(true);
  });

  test("a shell started on its own file settles what it starts", () => {
    expect(carriesUndecidedTarget("bash scripts/release.sh")).toBe(false);
  });

  test("text handed to an evaluator leaves the target undecided", () => {
    expect(carriesUndecidedTarget("eval $SETUP")).toBe(true);
  });

  test("a word a runner is spelled with is a runner", () => {
    expect(namesRunner("npx")).toBe(true);
  });

  test("a word no runner is spelled with is no runner", () => {
    expect(namesRunner("lerna")).toBe(false);
  });
});
