import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  assertionEntryRootNames,
  carriesSpelledTitle,
  declaresTestBlock,
  groupingBlockRootNames,
  runnerRootedTestBlockRootNames,
  testBlockBodyOf,
  testBlockRootNames,
  testCallbacksOf,
} from "./test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

describe("declaresTestBlock", () => {
  describe("read against the names test blocks are rooted in", () => {
    describe("a block written with an injected spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'it("names a behaviour", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("is a test block declaration", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a block written with the other injected spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'test("names a behaviour", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares the same way", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a block written with a modifier in front of an injected spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares the same way", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a table-driven block written on an injected spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'it.each(rows)("names a behaviour", (row) => {});').program
            .body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares the same way", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a grouping block", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'describe("names a group", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("is not a test block declaration", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a call reached through a receiver", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'suite.it("names a behaviour", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("is not a test block declaration", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a fixture factory", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", "test.extend({ subject: 1 });").program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("is not a test block declaration", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a renamed import of a block spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'import { it as check } from "vitest";\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares under the name it was bound to", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("an import written with a quoted export name", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'import { "test" as check } from "vitest";\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("is read the same way", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("an import of something other than a block spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'import { expect } from "vitest";\nexpect("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a default import", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'import runner from "vitest";\nrunner("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a namespace import", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'import * as runner from "vitest";\nrunner("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a local binding of a block spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'const check = it;\ncheck("names a behaviour", () => {});')
            .program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares under its own name", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a builder derived from the base", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'const check = test.extend({ subject: 1 });\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares under the name it was bound to", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a builder derived from another builder", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'const check = test.extend({ port: 1 }).extend({ subject: 2 });\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("reaches the same base", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a binding taken from a binding that was derived earlier", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'const base = test.extend({ subject: 1 });\nconst check = base;\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("declares the same way", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a member that is not the builder", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'const check = test.override({ subject: 1 });\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a binding initialised by a plain call", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'const check = build();\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a binding initialised by a value that is no call", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'const port = 3000;\nport("names a behaviour", () => {});')
            .program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a binding taken apart from an object", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'const { it: check } = runner;\ncheck("names a behaviour", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a binding declared without an initialiser", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'let check;\ncheck("names a behaviour", () => {});').program
            .body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          testBlockRootNames(program),
        );
      });

      it("binds no block", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });
  });

  describe("read against the names grouping blocks are rooted in", () => {
    describe("a group written with the injected spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'describe("names a group", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          groupingBlockRootNames(program),
        );
      });

      it("is a grouping block declaration", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a table-driven group written with the injected spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'describe.each(rows)("names a group", (row) => {});').program
            .body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          groupingBlockRootNames(program),
        );
      });

      it("declares the same way", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a test block", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'it("names a behaviour", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          groupingBlockRootNames(program),
        );
      });

      it("is not a grouping block declaration", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("the other test block spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'test("names a behaviour", () => {});').program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          groupingBlockRootNames(program),
        );
      });

      it("is not a grouping block declaration either", ({ declaration }) => {
        expect(declaration).toBe(false);
      });
    });

    describe("a renamed import of the grouping spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync(
            "spec.ts",
            'import { describe as group } from "vitest";\ngroup("a group", () => {});',
          ).program.body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          groupingBlockRootNames(program),
        );
      });

      it("declares under the name it was bound to", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });

    describe("a local binding of the grouping spelling", () => {
      const it = test.extend("declaration", () => {
        const program = {
          type: "Program",
          body: parseSync("spec.ts", 'const group = describe;\ngroup("a group", () => {});').program
            .body,
        } as ESTree.Program;
        const last = program.body.at(-1) as ESTree.ExpressionStatement;
        return declaresTestBlock(
          last.expression as ESTree.CallExpression,
          groupingBlockRootNames(program),
        );
      });

      it("declares under its own name", ({ declaration }) => {
        expect(declaration).toBe(true);
      });
    });
  });
});

describe("assertionEntryRootNames", () => {
  describe("the injected assertion entry", () => {
    const it = test.extend("assertionEntryRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const port = 3000;").program.body,
      } as ESTree.Program;
      return assertionEntryRootNames(program);
    });

    it("stands under its own spelling", ({ assertionEntryRoots }) => {
      expect(assertionEntryRoots).toStrictEqual(new Set(["expect"]));
    });
  });

  describe("a renamed import of the assertion entry", () => {
    const it = test.extend("assertionEntryRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'import { expect as assertThat } from "vitest";').program.body,
      } as ESTree.Program;
      return assertionEntryRootNames(program);
    });

    it("stands under the name it was bound to", ({ assertionEntryRoots }) => {
      expect(assertionEntryRoots).toStrictEqual(new Set(["assertThat", "expect"]));
    });
  });

  describe("a local binding of the assertion entry", () => {
    const it = test.extend("assertionEntryRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const assertThat = expect;").program.body,
      } as ESTree.Program;
      return assertionEntryRootNames(program);
    });

    it("stands under its own name", ({ assertionEntryRoots }) => {
      expect(assertionEntryRoots).toStrictEqual(new Set(["assertThat", "expect"]));
    });
  });

  describe("a test block spelling", () => {
    const it = test.extend("assertionEntryRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const check = it;").program.body,
      } as ESTree.Program;
      return assertionEntryRootNames(program);
    });

    it("binds no assertion entry", ({ assertionEntryRoots }) => {
      expect(assertionEntryRoots).toStrictEqual(new Set(["expect"]));
    });
  });
});

describe("runnerRootedTestBlockRootNames", () => {
  describe("a spelling the runner injects", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const port = 3000;").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stands as a root while nothing in the file takes its name", ({
      runnerRootedTestBlockRoots,
    }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "test"]));
    });
  });

  describe("a renamed import from the test runner", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'import { it as check } from "vitest";').program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stands as a root under the name it was bound to", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["check", "it", "test"]));
    });
  });

  describe("an import of a spelling from a module that is no test runner", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'import { it } from "./runner.ts";').program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("takes that name away", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["test"]));
    });
  });

  describe("a binding derived from the runner", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const it = test.extend({ subject: 1 });").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stands as a root under its own name", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "test"]));
    });
  });

  describe("a binding of a spelling that reaches no runner", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const it = buildRunner();").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("takes that name away", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["test"]));
    });
  });

  describe("a function declaration taking a spelling", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "function it(title, body) {}").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("takes that name away", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["test"]));
    });
  });

  describe("a function declared without a name", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "export default function () {}").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("leaves every spelling standing", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "test"]));
    });
  });

  describe("a binding taken apart from an object", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "const { it } = runner;").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("leaves every spelling standing", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "test"]));
    });
  });

  describe("a binding declared without an initialiser", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "let it;").program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("takes that name away", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["test"]));
    });
  });

  describe("an imported binding standing on its own", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'import { standardIoTest } from "./standard-io-test.ts";')
          .program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stays out of the roots", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "test"]));
    });
  });

  describe("a binding derived from an imported factory", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync(
          "spec.ts",
          'import { standardIoTest } from "./standard-io-test.ts";\nconst spec = standardIoTest.extend("subject", () => 1);',
        ).program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stands as a root under its own name", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "spec", "test"]));
    });
  });

  describe("a binding derived through a chain of extends from an imported factory", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync(
          "spec.ts",
          'import { standardIoTest } from "./standard-io-test.ts";\nconst spec = standardIoTest.extend("a", () => 1).extend("b", () => 2);',
        ).program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stands as a root the same way", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "spec", "test"]));
    });
  });

  describe("a binding derived from a default import", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync(
          "spec.ts",
          'import runner from "./standard-io-test.ts";\nconst spec = runner.extend("subject", () => 1);',
        ).program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("stays out of the roots, since only named imports are followed", ({
      runnerRootedTestBlockRoots,
    }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["it", "test"]));
    });
  });

  describe("a binding filled by a call on an imported name that builds no fixture", () => {
    const it = test.extend("runnerRootedTestBlockRoots", () => {
      const program = {
        type: "Program",
        body: parseSync(
          "spec.ts",
          'import { buildRunner } from "./runner.ts";\nconst it = buildRunner();',
        ).program.body,
      } as ESTree.Program;
      return runnerRootedTestBlockRootNames(program);
    });

    it("takes that name away", ({ runnerRootedTestBlockRoots }) => {
      expect(runnerRootedTestBlockRoots).toStrictEqual(new Set(["test"]));
    });
  });
});

describe("testCallbacksOf", () => {
  describe("an arrow handed to a block", () => {
    const it = test.extend("callbackShapes", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testCallbacksOf(written).map((testCallback) => testCallback.type);
    });

    it("is read as its callback", ({ callbackShapes }) => {
      expect(callbackShapes).toStrictEqual(["ArrowFunctionExpression"]);
    });
  });

  describe("a function expression handed to a block", () => {
    const it = test.extend("callbackShapes", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", function () {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testCallbacksOf(written).map((testCallback) => testCallback.type);
    });

    it("is read as its callback as well", ({ callbackShapes }) => {
      expect(callbackShapes).toStrictEqual(["FunctionExpression"]);
    });
  });

  describe("a value handed to a block that is no function", () => {
    const it = test.extend("callbackShapes", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", 3000);').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testCallbacksOf(written).map((testCallback) => testCallback.type);
    });

    it("is no callback", ({ callbackShapes }) => {
      expect(callbackShapes).toStrictEqual([]);
    });
  });

  describe("a function handed through a wrapping call", () => {
    const it = test.extend("callbackShapes", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", withSetup(() => {}));')
        .program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testCallbacksOf(written).map((testCallback) => testCallback.type);
    });

    it("is still the callback", ({ callbackShapes }) => {
      expect(callbackShapes).toStrictEqual(["ArrowFunctionExpression"]);
    });
  });

  describe("a callback spread into the block", () => {
    const it = test.extend("callbackShapes", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", ...handlers);').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testCallbacksOf(written).map((testCallback) => testCallback.type);
    });

    it("hides itself from this reading", ({ callbackShapes }) => {
      expect(callbackShapes).toStrictEqual([]);
    });
  });

  describe("a callback spread into a wrapping call", () => {
    const it = test.extend("callbackShapes", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", withSetup(...handlers));')
        .program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testCallbacksOf(written).map((testCallback) => testCallback.type);
    });

    it("hides itself the same way", ({ callbackShapes }) => {
      expect(callbackShapes).toStrictEqual([]);
    });
  });
});

describe("carriesSpelledTitle", () => {
  describe("a name written out as a string", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("is a spelled title", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(true);
    });
  });

  describe("a name assembled by a template", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", "it(`names ${behaviour}`, () => {});").program
        .body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("is a spelled title", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(true);
    });
  });

  describe("a name that is no string", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", "it(3000, () => {});").program
        .body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("leaves the block without a spelled title", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(false);
    });
  });

  describe("a name held by a binding", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", "it(behaviour, () => {});").program
        .body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("leaves the block without a spelled title as well", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(false);
    });
  });

  describe("a block opening with its callback", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", "it(() => {});").program
        .body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("carries no spelled title", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(false);
    });
  });

  describe("a block whose first argument is spread", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", "it(...declaration);").program
        .body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("carries no spelled title", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(false);
    });
  });

  describe("a block handed nothing", () => {
    const it = test.extend("spelledTitle", () => {
      const statement = parseSync("spec.ts", "it();").program.body[0] as ESTree.ExpressionStatement;
      return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
    });

    it("carries no spelled title", ({ spelledTitle }) => {
      expect(spelledTitle).toBe(false);
    });
  });
});

describe("testBlockBodyOf", () => {
  describe("a named block", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'it("names a behaviour", () => {});').program.body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("hands over the function that carries its body", ({ bodyShape }) => {
      expect(bodyShape).toBe("ArrowFunctionExpression");
    });
  });

  describe("a named block handed a function expression", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'it("names a behaviour", function () {});').program.body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("hands that function over", ({ bodyShape }) => {
      expect(bodyShape).toBe("FunctionExpression");
    });
  });

  describe("a body written behind an options object", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'it("names a behaviour", { retry: 2 }, () => {}, 1000);').program
          .body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("is still the body", ({ bodyShape }) => {
      expect(bodyShape).toBe("ArrowFunctionExpression");
    });
  });

  describe("a body reached through a derived builder", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync(
          "spec.ts",
          'const check = test.extend({ subject: 1 });\ncheck("a behaviour", () => {});',
        ).program.body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("is read the same way", ({ bodyShape }) => {
      expect(bodyShape).toBe("ArrowFunctionExpression");
    });
  });

  describe("a block handed no callback", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'it("names a behaviour");').program.body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("hands over no body", ({ bodyShape }) => {
      expect(bodyShape).toBe(null);
    });
  });

  describe("a block without a spelled title", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", "it(() => {});").program.body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("hands over no body", ({ bodyShape }) => {
      expect(bodyShape).toBe(null);
    });
  });

  describe("a call that declares no test block", () => {
    const it = test.extend("bodyShape", () => {
      const program = {
        type: "Program",
        body: parseSync("spec.ts", 'describe("names a group", () => {});').program.body,
      } as ESTree.Program;
      const last = program.body.at(-1) as ESTree.ExpressionStatement;
      const testBlockBody = testBlockBodyOf(
        last.expression as ESTree.CallExpression,
        testBlockRootNames(program),
      );
      return testBlockBody === null ? null : testBlockBody.type;
    });

    it("hands over no body", ({ bodyShape }) => {
      expect(bodyShape).toBe(null);
    });
  });
});
