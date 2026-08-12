import { describe, expect, test } from "vite-plus/test";

import { carriesUndecidedTarget, invokedNamesIn, namesRunner } from "./command-lines.ts";

const it = test
  .extend("namesOfALineWhoseFirstWordIsTheCommand", () => invokedNamesIn("lerna run build"))
  .extend("namesOfALineHoldingNothing", () => invokedNamesIn(""))
  .extend("namesOfALineNamingTheToolAsAnArgument", () =>
    invokedNamesIn("node ./node_modules/lerna/cli.js"),
  )
  .extend("namesOfACommandChain", () => invokedNamesIn("tsc && lerna run build"))
  .extend("namesOfCommandsSeparatedByASemicolon", () => invokedNamesIn("tsc; lerna"))
  .extend("namesOfCommandsJoinedByAPipe", () => invokedNamesIn("cat list | lerna"))
  .extend("namesOfCommandsJoinedByAnAlternative", () => invokedNamesIn("tsc || lerna"))
  .extend("namesOfACommandInsideBrackets", () => invokedNamesIn("(lerna run build)"))
  .extend("namesOfALineLedByEnvironmentBindings", () =>
    invokedNamesIn("NODE_ENV=test CI=1 lerna run build"),
  )
  .extend("namesOfALineLedByARunner", () => invokedNamesIn("npx lerna run build"))
  .extend("namesOfALineLedByATwoWordRunner", () => invokedNamesIn("pnpm dlx lerna"))
  .extend("namesOfALineCarryingFlagsBehindTheRunner", () => invokedNamesIn("npx --yes -- lerna"))
  .extend("namesOfARunnerArgumentCarryingAVersion", () =>
    invokedNamesIn("npx lerna@8.0.0 run build"),
  )
  .extend("namesOfAScopedRunnerArgumentCarryingAVersion", () =>
    invokedNamesIn("npx @scope/lerna@8.0.0"),
  )
  .extend("namesOfAScopedRunnerArgumentWithoutAVersion", () => invokedNamesIn("npx @scope/lerna"))
  .extend("namesOfAShellHandedAnInlineScript", () => invokedNamesIn('bash -c "lerna run build"'))
  .extend("namesOfAShellHandedAScriptFile", () => invokedNamesIn("bash scripts/release.sh"))
  .extend("namesOfAFetchedAddress", () =>
    invokedNamesIn("curl https://example.com/lerna/install.sh"),
  )
  .extend("namesOfACommandSettledByASubstitution", () => invokedNamesIn("$TOOL run build"))
  .extend("undecidedTargetOfALineSpellingOutItsCommand", () =>
    carriesUndecidedTarget("lerna run build"),
  )
  .extend("undecidedTargetOfALineHoldingNothing", () => carriesUndecidedTarget(""))
  .extend("undecidedTargetOfACommandSettledByASubstitution", () =>
    carriesUndecidedTarget("$TOOL run build"),
  )
  .extend("undecidedTargetOfFetchedTextHandedToAShell", () =>
    carriesUndecidedTarget("curl https://example.com/install.sh | bash"),
  )
  .extend("undecidedTargetOfAShellStartedOnItsOwnFile", () =>
    carriesUndecidedTarget("bash scripts/release.sh"),
  )
  .extend("undecidedTargetOfTextHandedToAnEvaluator", () => carriesUndecidedTarget("eval $SETUP"))
  .extend("runnerReadingOfAWordARunnerIsSpelledWith", () => namesRunner("npx"))
  .extend("runnerReadingOfAWordNoRunnerIsSpelledWith", () => namesRunner("lerna"));

describe("declared-replacements/command-lines", () => {
  it("the first word of a line is the command it starts", ({
    namesOfALineWhoseFirstWordIsTheCommand,
  }) => {
    expect(namesOfALineWhoseFirstWordIsTheCommand).toStrictEqual(["lerna"]);
  });

  it("a line holding nothing starts no command", ({ namesOfALineHoldingNothing }) => {
    expect(namesOfALineHoldingNothing).toStrictEqual([]);
  });

  it("a name written as an argument is not the command", ({
    namesOfALineNamingTheToolAsAnArgument,
  }) => {
    expect(namesOfALineNamingTheToolAsAnArgument).toStrictEqual(["node"]);
  });

  it("each side of a chain is read as its own command", ({ namesOfACommandChain }) => {
    expect(namesOfACommandChain).toStrictEqual(["tsc", "lerna"]);
  });

  it("commands separated by a semicolon are read one by one", ({
    namesOfCommandsSeparatedByASemicolon,
  }) => {
    expect(namesOfCommandsSeparatedByASemicolon).toStrictEqual(["tsc", "lerna"]);
  });

  it("commands joined by a pipe are read one by one", ({ namesOfCommandsJoinedByAPipe }) => {
    expect(namesOfCommandsJoinedByAPipe).toStrictEqual(["cat", "lerna"]);
  });

  it("commands joined by an alternative are read one by one", ({
    namesOfCommandsJoinedByAnAlternative,
  }) => {
    expect(namesOfCommandsJoinedByAnAlternative).toStrictEqual(["tsc", "lerna"]);
  });

  it("a command written inside brackets is read on its own", ({
    namesOfACommandInsideBrackets,
  }) => {
    expect(namesOfACommandInsideBrackets).toStrictEqual(["lerna"]);
  });

  it("environment bindings written in front of a command are stepped over", ({
    namesOfALineLedByEnvironmentBindings,
  }) => {
    expect(namesOfALineLedByEnvironmentBindings).toStrictEqual(["lerna"]);
  });

  it("a runner written in front of a command hands the position to what it runs", ({
    namesOfALineLedByARunner,
  }) => {
    expect(namesOfALineLedByARunner).toStrictEqual(["lerna"]);
  });

  it("a runner written as two words hands the position to what it runs", ({
    namesOfALineLedByATwoWordRunner,
  }) => {
    expect(namesOfALineLedByATwoWordRunner).toStrictEqual(["lerna"]);
  });

  it("flags written behind a runner are stepped over", ({
    namesOfALineCarryingFlagsBehindTheRunner,
  }) => {
    expect(namesOfALineCarryingFlagsBehindTheRunner).toStrictEqual(["lerna"]);
  });

  it("a version written on a runner argument is dropped", ({
    namesOfARunnerArgumentCarryingAVersion,
  }) => {
    expect(namesOfARunnerArgumentCarryingAVersion).toStrictEqual(["lerna"]);
  });

  it("a scoped name keeps its scope when its version is dropped", ({
    namesOfAScopedRunnerArgumentCarryingAVersion,
  }) => {
    expect(namesOfAScopedRunnerArgumentCarryingAVersion).toStrictEqual(["@scope/lerna"]);
  });

  it("a scoped name written without a version stands as it is", ({
    namesOfAScopedRunnerArgumentWithoutAVersion,
  }) => {
    expect(namesOfAScopedRunnerArgumentWithoutAVersion).toStrictEqual(["@scope/lerna"]);
  });

  it("a shell handed an inline script hands the position to what the script starts", ({
    namesOfAShellHandedAnInlineScript,
  }) => {
    expect(namesOfAShellHandedAnInlineScript).toStrictEqual(["lerna"]);
  });

  it("a shell handed a script file starts the shell", ({ namesOfAShellHandedAScriptFile }) => {
    expect(namesOfAShellHandedAScriptFile).toStrictEqual(["bash"]);
  });

  it("the elements of a fetched address are read one by one", ({ namesOfAFetchedAddress }) => {
    expect(namesOfAFetchedAddress).toStrictEqual([
      "curl",
      "https:",
      "example.com",
      "lerna",
      "install.sh",
    ]);
  });

  it("a command settled by a substitution names nothing", ({
    namesOfACommandSettledByASubstitution,
  }) => {
    expect(namesOfACommandSettledByASubstitution).toStrictEqual([]);
  });

  it("a line spelling out its command settles what it starts", ({
    undecidedTargetOfALineSpellingOutItsCommand,
  }) => {
    expect(undecidedTargetOfALineSpellingOutItsCommand).toBe(false);
  });

  it("a line holding nothing settles what it starts", ({
    undecidedTargetOfALineHoldingNothing,
  }) => {
    expect(undecidedTargetOfALineHoldingNothing).toBe(false);
  });

  it("a command settled by a substitution leaves the target undecided", ({
    undecidedTargetOfACommandSettledByASubstitution,
  }) => {
    expect(undecidedTargetOfACommandSettledByASubstitution).toBe(true);
  });

  it("fetched text handed to a shell leaves the target undecided", ({
    undecidedTargetOfFetchedTextHandedToAShell,
  }) => {
    expect(undecidedTargetOfFetchedTextHandedToAShell).toBe(true);
  });

  it("a shell started on its own file settles what it starts", ({
    undecidedTargetOfAShellStartedOnItsOwnFile,
  }) => {
    expect(undecidedTargetOfAShellStartedOnItsOwnFile).toBe(false);
  });

  it("text handed to an evaluator leaves the target undecided", ({
    undecidedTargetOfTextHandedToAnEvaluator,
  }) => {
    expect(undecidedTargetOfTextHandedToAnEvaluator).toBe(true);
  });

  it("a word a runner is spelled with is a runner", ({
    runnerReadingOfAWordARunnerIsSpelledWith,
  }) => {
    expect(runnerReadingOfAWordARunnerIsSpelledWith).toBe(true);
  });

  it("a word no runner is spelled with is no runner", ({
    runnerReadingOfAWordNoRunnerIsSpelledWith,
  }) => {
    expect(runnerReadingOfAWordNoRunnerIsSpelledWith).toBe(false);
  });
});
