import { describe, expect, test } from "vite-plus/test";

import { carriesUndecidedTarget, invokedNamesIn, namesRunner } from "./command-lines.ts";

describe("invokedNamesIn", () => {
  describe("a line whose first word is the command", () => {
    const it = test.extend("names", () => invokedNamesIn("lerna run build"));

    it("reads the first word as the command the line starts", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a line holding nothing", () => {
    const it = test.extend("names", () => invokedNamesIn(""));

    it("starts no command", ({ names }) => {
      expect(names).toStrictEqual([]);
    });
  });

  describe("a line naming the tool as an argument", () => {
    const it = test.extend("names", () => invokedNamesIn("node ./node_modules/lerna/cli.js"));

    it("reads a name written as an argument as something other than the command", ({ names }) => {
      expect(names).toStrictEqual(["node"]);
    });
  });

  describe("a command chain", () => {
    const it = test.extend("names", () => invokedNamesIn("tsc && lerna run build"));

    it("reads each side of the chain as its own command", ({ names }) => {
      expect(names).toStrictEqual(["tsc", "lerna"]);
    });
  });

  describe("commands separated by a semicolon", () => {
    const it = test.extend("names", () => invokedNamesIn("tsc; lerna"));

    it("reads them one by one", ({ names }) => {
      expect(names).toStrictEqual(["tsc", "lerna"]);
    });
  });

  describe("commands joined by a pipe", () => {
    const it = test.extend("names", () => invokedNamesIn("cat list | lerna"));

    it("reads them one by one", ({ names }) => {
      expect(names).toStrictEqual(["cat", "lerna"]);
    });
  });

  describe("commands joined by an alternative", () => {
    const it = test.extend("names", () => invokedNamesIn("tsc || lerna"));

    it("reads them one by one", ({ names }) => {
      expect(names).toStrictEqual(["tsc", "lerna"]);
    });
  });

  describe("a command written inside brackets", () => {
    const it = test.extend("names", () => invokedNamesIn("(lerna run build)"));

    it("is read on its own", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a line led by environment bindings", () => {
    const it = test.extend("names", () => invokedNamesIn("NODE_ENV=test CI=1 lerna run build"));

    it("steps over the bindings written in front of the command", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a line led by a runner", () => {
    const it = test.extend("names", () => invokedNamesIn("npx lerna run build"));

    it("hands the position to what the runner runs", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a line led by a two-word runner", () => {
    const it = test.extend("names", () => invokedNamesIn("pnpm dlx lerna"));

    it("hands the position to what the runner runs", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a line carrying flags behind the runner", () => {
    const it = test.extend("names", () => invokedNamesIn("npx --yes -- lerna"));

    it("steps over the flags", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a runner argument carrying a version", () => {
    const it = test.extend("names", () => invokedNamesIn("npx lerna@8.0.0 run build"));

    it("drops the version", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a scoped runner argument carrying a version", () => {
    const it = test.extend("names", () => invokedNamesIn("npx @scope/lerna@8.0.0"));

    it("keeps the scope when the version is dropped", ({ names }) => {
      expect(names).toStrictEqual(["@scope/lerna"]);
    });
  });

  describe("a scoped runner argument written without a version", () => {
    const it = test.extend("names", () => invokedNamesIn("npx @scope/lerna"));

    it("stands as it is", ({ names }) => {
      expect(names).toStrictEqual(["@scope/lerna"]);
    });
  });

  describe("a shell handed an inline script", () => {
    const it = test.extend("names", () => invokedNamesIn('bash -c "lerna run build"'));

    it("hands the position to what the script starts", ({ names }) => {
      expect(names).toStrictEqual(["lerna"]);
    });
  });

  describe("a shell handed a script file", () => {
    const it = test.extend("names", () => invokedNamesIn("bash scripts/release.sh"));

    it("starts the shell", ({ names }) => {
      expect(names).toStrictEqual(["bash"]);
    });
  });

  describe("a fetched address", () => {
    const it = test.extend("names", () =>
      invokedNamesIn("curl https://example.com/lerna/install.sh"));

    it("reads the elements of the address one by one", ({ names }) => {
      expect(names).toStrictEqual(["curl", "https:", "example.com", "lerna", "install.sh"]);
    });
  });

  describe("a command settled by a substitution", () => {
    const it = test.extend("names", () => invokedNamesIn("$TOOL run build"));

    it("names nothing", ({ names }) => {
      expect(names).toStrictEqual([]);
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
