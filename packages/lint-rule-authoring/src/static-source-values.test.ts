import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { listedNodesOf, moduleConstantsIn, nodesIn, resolveText } from "./static-source-values.ts";

describe("resolveText", () => {
  describe("a list written in place and joined", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(parseSync("held.ts", 'const subject = ["a", "b"].join("-");').program.body),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("reads the parts joined by the separator", ({ resolved }) => {
      expect(resolved).toStrictEqual([["subject", "a-b"]]);
    });
  });

  describe("a list named by a constant of the same file", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(
          parseSync("held.ts", 'const parts = ["a", "b"];\nconst subject = parts.join(" ");')
            .program.body,
        ),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("follows the name to the list before joining it", ({ resolved }) => {
      expect(resolved).toStrictEqual([
        ["parts", null],
        ["subject", "a b"],
      ]);
    });
  });

  describe("a join handed no separator", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(parseSync("held.ts", 'const subject = ["a", "b"].join();').program.body),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("joins the parts the way the language does without one", ({ resolved }) => {
      expect(resolved).toStrictEqual([["subject", "a,b"]]);
    });
  });

  describe("a list this file never declares", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(parseSync("held.ts", 'const subject = parts.join(" ");').program.body),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("settles on no text at all", ({ resolved }) => {
      expect(resolved).toStrictEqual([["subject", null]]);
    });
  });

  describe("a list whose name stands on itself", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(
          parseSync("held.ts", 'const parts = parts;\nconst subject = parts.join(" ");').program
            .body,
        ),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("stops at the name it has already walked through", ({ resolved }) => {
      expect(resolved).toStrictEqual([
        ["parts", null],
        ["subject", null],
      ]);
    });
  });

  describe("a join standing on something that is no list", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(parseSync("held.ts", 'const subject = read().join(" ");').program.body),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("settles on no text at all", ({ resolved }) => {
      expect(resolved).toStrictEqual([["subject", null]]);
    });
  });

  describe("a list holding a part this reader cannot settle", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(parseSync("held.ts", 'const subject = ["a", read()].join(" ");').program.body),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("settles on no text at all", ({ resolved }) => {
      expect(resolved).toStrictEqual([["subject", null]]);
    });
  });

  describe("a separator settled while the program runs", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(parseSync("held.ts", 'const subject = ["a", "b"].join(chosen);').program.body),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("settles on no text at all", ({ resolved }) => {
      expect(resolved).toStrictEqual([["subject", null]]);
    });
  });

  describe("calls that name no join", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(
          parseSync(
            "held.ts",
            'const bare = read("a");\nconst chosen = parts[picked]("-");\nconst other = parts.slice(1);',
          ).program.body,
        ),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("settle on no text, whichever way the callee is written", ({ resolved }) => {
      expect(resolved).toStrictEqual([
        ["bare", null],
        ["chosen", null],
        ["other", null],
      ]);
    });
  });

  describe("values that are neither text nor a shape this reader walks", () => {
    const it = test.extend("resolved", () => {
      const constants = moduleConstantsIn(
        nodesIn(
          parseSync(
            "held.ts",
            'const counted = 1;\nconst picked = ready ? "a" : "b";\nconst joined = "a" + "b";',
          ).program.body,
        ),
      );
      return [...constants].map(([spelled, node]) => [
        spelled,
        resolveText({ node, constants, visited: [] }),
      ]);
    });

    it("read the concatenation and leave the rest at no text", ({ resolved }) => {
      expect(resolved).toStrictEqual([
        ["counted", null],
        ["picked", null],
        ["joined", "ab"],
      ]);
    });
  });
});

describe("listedNodesOf", () => {
  describe("constants written as a list, as a name for one, and as neither", () => {
    const it = test.extend("listed", () => {
      const constants = moduleConstantsIn(
        nodesIn(
          parseSync(
            "held.ts",
            'const parts = ["a", "b"];\nconst named = parts;\nconst counted = 1;',
          ).program.body,
        ),
      );
      return [...constants].map(([spelled, node]) => {
        const listed = listedNodesOf({ node, constants, visited: [] });
        return [spelled, listed === null ? null : listed.map((part) => part.type)];
      });
    });

    it("walks a list, follows a name to one, and settles on nothing otherwise", ({ listed }) => {
      expect(listed).toStrictEqual([
        ["parts", ["Literal", "Literal"]],
        ["named", ["Literal", "Literal"]],
        ["counted", null],
      ]);
    });
  });
});
