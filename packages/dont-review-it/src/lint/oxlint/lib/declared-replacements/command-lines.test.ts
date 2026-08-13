import { describe, expect, test } from "vite-plus/test";

import { carriesUndecidedTarget, invokedNamesIn, namesRunner } from "./command-lines.ts";

describe("invokedNamesIn", () => {
  describe("a line whose first word is the command", () => {
    const it = test.extend("commandsInLernaRunBuild", () => invokedNamesIn("lerna run build"));

    it("reads the first word as the command the line starts", ({ commandsInLernaRunBuild }) => {
      expect(commandsInLernaRunBuild).toStrictEqual(["lerna"]);
    });
  });

  describe("a line holding nothing", () => {
    const it = test.extend("commandsInAnEmptyLine", () => invokedNamesIn(""));

    it("starts no command", ({ commandsInAnEmptyLine }) => {
      expect(commandsInAnEmptyLine).toStrictEqual([]);
    });
  });

  describe("a line naming the tool as an argument", () => {
    const it = test.extend("commandsInANodeInvocation", () =>
      invokedNamesIn("node ./node_modules/lerna/cli.js"));

    it("reads a name written as an argument as something other than the command", ({
      commandsInANodeInvocation,
    }) => {
      expect(commandsInANodeInvocation).toStrictEqual(["node"]);
    });
  });

  describe("a command chain", () => {
    const it = test.extend("commandsInAChain", () => invokedNamesIn("tsc && lerna run build"));

    it("reads each side of the chain as its own command", ({ commandsInAChain }) => {
      expect(commandsInAChain).toStrictEqual(["tsc", "lerna"]);
    });
  });

  describe("commands separated by a semicolon", () => {
    const it = test.extend("commandsInASemicolonSequence", () => invokedNamesIn("tsc; lerna"));

    it("reads them one by one", ({ commandsInASemicolonSequence }) => {
      expect(commandsInASemicolonSequence).toStrictEqual(["tsc", "lerna"]);
    });
  });

  describe("commands joined by a pipe", () => {
    const it = test.extend("commandsInAPipeline", () => invokedNamesIn("cat list | lerna"));

    it("reads them one by one", ({ commandsInAPipeline }) => {
      expect(commandsInAPipeline).toStrictEqual(["cat", "lerna"]);
    });
  });

  describe("commands joined by an alternative", () => {
    const it = test.extend("commandsInAnAlternative", () => invokedNamesIn("tsc || lerna"));

    it("reads them one by one", ({ commandsInAnAlternative }) => {
      expect(commandsInAnAlternative).toStrictEqual(["tsc", "lerna"]);
    });
  });

  describe("a command written inside brackets", () => {
    const it = test.extend("commandsInBrackets", () => invokedNamesIn("(lerna run build)"));

    it("is read on its own", ({ commandsInBrackets }) => {
      expect(commandsInBrackets).toStrictEqual(["lerna"]);
    });
  });

  describe("a line led by environment bindings", () => {
    const it = test.extend("commandsBehindEnvironmentBindings", () =>
      invokedNamesIn("NODE_ENV=test CI=1 lerna run build"));

    it("steps over the bindings written in front of the command", ({
      commandsBehindEnvironmentBindings,
    }) => {
      expect(commandsBehindEnvironmentBindings).toStrictEqual(["lerna"]);
    });
  });

  describe("a line led by a runner", () => {
    const it = test.extend("commandsBehindNpx", () => invokedNamesIn("npx lerna run build"));

    it("hands the position to what the runner runs", ({ commandsBehindNpx }) => {
      expect(commandsBehindNpx).toStrictEqual(["lerna"]);
    });
  });

  describe("a line led by a two-word runner", () => {
    const it = test.extend("commandsBehindPnpmDlx", () => invokedNamesIn("pnpm dlx lerna"));

    it("hands the position to what the runner runs", ({ commandsBehindPnpmDlx }) => {
      expect(commandsBehindPnpmDlx).toStrictEqual(["lerna"]);
    });
  });

  describe("a line carrying flags behind the runner", () => {
    const it = test.extend("commandsBehindRunnerFlags", () => invokedNamesIn("npx --yes -- lerna"));

    it("steps over the flags", ({ commandsBehindRunnerFlags }) => {
      expect(commandsBehindRunnerFlags).toStrictEqual(["lerna"]);
    });
  });

  describe("a runner argument carrying a version", () => {
    const it = test.extend("commandsBehindAVersionedRunnerArgument", () =>
      invokedNamesIn("npx lerna@8.0.0 run build"));

    it("drops the version", ({ commandsBehindAVersionedRunnerArgument }) => {
      expect(commandsBehindAVersionedRunnerArgument).toStrictEqual(["lerna"]);
    });
  });

  describe("a scoped runner argument carrying a version", () => {
    const it = test.extend("commandsBehindAVersionedScopedRunnerArgument", () =>
      invokedNamesIn("npx @scope/lerna@8.0.0"));

    it("keeps the scope when the version is dropped", ({
      commandsBehindAVersionedScopedRunnerArgument,
    }) => {
      expect(commandsBehindAVersionedScopedRunnerArgument).toStrictEqual(["@scope/lerna"]);
    });
  });

  describe("a scoped runner argument written without a version", () => {
    const it = test.extend("commandsBehindAScopedRunnerArgument", () =>
      invokedNamesIn("npx @scope/lerna"));

    it("stands as it is", ({ commandsBehindAScopedRunnerArgument }) => {
      expect(commandsBehindAScopedRunnerArgument).toStrictEqual(["@scope/lerna"]);
    });
  });

  describe("a shell handed an inline script", () => {
    const it = test.extend("commandsInAnInlineShellScript", () =>
      invokedNamesIn('bash -c "lerna run build"'));

    it("hands the position to what the script starts", ({ commandsInAnInlineShellScript }) => {
      expect(commandsInAnInlineShellScript).toStrictEqual(["lerna"]);
    });
  });

  describe("a shell handed a script file", () => {
    const it = test.extend("commandsInAShellScriptFile", () =>
      invokedNamesIn("bash scripts/release.sh"));

    it("starts the shell", ({ commandsInAShellScriptFile }) => {
      expect(commandsInAShellScriptFile).toStrictEqual(["bash"]);
    });
  });

  describe("a fetched address", () => {
    const it = test.extend("commandsInAFetchedAddress", () =>
      invokedNamesIn("curl https://example.com/lerna/install.sh"));

    it("reads the elements of the address one by one", ({ commandsInAFetchedAddress }) => {
      expect(commandsInAFetchedAddress).toStrictEqual([
        "curl",
        "https:",
        "example.com",
        "lerna",
        "install.sh",
      ]);
    });
  });

  describe("a command settled by a substitution", () => {
    const it = test.extend("commandsBehindASubstitution", () => invokedNamesIn("$TOOL run build"));

    it("names nothing", ({ commandsBehindASubstitution }) => {
      expect(commandsBehindASubstitution).toStrictEqual([]);
    });
  });
});

describe("carriesUndecidedTarget", () => {
  describe("a line spelling out its command", () => {
    const it = test.extend("undecided", () => carriesUndecidedTarget("lerna run build"));

    it("settles what the line starts", ({ undecided }) => {
      expect(undecided).toBe(false);
    });
  });

  describe("a line holding nothing", () => {
    const it = test.extend("undecided", () => carriesUndecidedTarget(""));

    it("settles what the line starts", ({ undecided }) => {
      expect(undecided).toBe(false);
    });
  });

  describe("a command settled by a substitution", () => {
    const it = test.extend("undecided", () => carriesUndecidedTarget("$TOOL run build"));

    it("leaves the target undecided", ({ undecided }) => {
      expect(undecided).toBe(true);
    });
  });

  describe("fetched text handed to a shell", () => {
    const it = test.extend("undecided", () =>
      carriesUndecidedTarget("curl https://example.com/install.sh | bash"));

    it("leaves the target undecided", ({ undecided }) => {
      expect(undecided).toBe(true);
    });
  });

  describe("a shell started on its own file", () => {
    const it = test.extend("undecided", () => carriesUndecidedTarget("bash scripts/release.sh"));

    it("settles what the line starts", ({ undecided }) => {
      expect(undecided).toBe(false);
    });
  });

  describe("text handed to an evaluator", () => {
    const it = test.extend("undecided", () => carriesUndecidedTarget("eval $SETUP"));

    it("leaves the target undecided", ({ undecided }) => {
      expect(undecided).toBe(true);
    });
  });
});

describe("namesRunner", () => {
  describe("a word a runner is spelled with", () => {
    const it = test.extend("runnerReading", () => namesRunner("npx"));

    it("is a runner", ({ runnerReading }) => {
      expect(runnerReading).toBe(true);
    });
  });

  describe("a word no runner is spelled with", () => {
    const it = test.extend("runnerReading", () => namesRunner("lerna"));

    it("is no runner", ({ runnerReading }) => {
      expect(runnerReading).toBe(false);
    });
  });
});
