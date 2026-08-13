import { describe, expect, test } from "vite-plus/test";

import { classSitesIn } from "./stylesheet-classes.ts";

describe("classSitesIn", () => {
  describe("a class selector standing after another rule", () => {
    const it = test.extend("sites", () =>
      classSitesIn("body {\n  margin: 0;\n}\n\n.counter {\n  color: red;\n}\n"));

    it("takes the class with the line it stands on", ({ sites }) => {
      expect(sites).toStrictEqual([{ name: "counter", line: 5 }]);
    });
  });

  describe("a class nested in an at-rule", () => {
    const it = test.extend("sites", () =>
      classSitesIn("@media (max-width: 1024px) {\n  .wide {\n    color: red;\n  }\n}\n"));

    it("takes the nested class and leaves the at-rule prelude out", ({ sites }) => {
      expect(sites).toStrictEqual([{ name: "wide", line: 2 }]);
    });
  });

  describe("a class-like word inside a comment", () => {
    const it = test.extend("sites", () =>
      classSitesIn("/*\n .ghost\n*/\n.real {\n  color: red;\n}\n"));

    it("leaves the commented word out and keeps the lines after it in place", ({ sites }) => {
      expect(sites).toStrictEqual([{ name: "real", line: 4 }]);
    });
  });

  describe("a class-like word inside an unquoted url", () => {
    const it = test.extend("sites", () =>
      classSitesIn(".logo {\n  background: url(./hero.png);\n}\n"));

    it("leaves the word in the url out", ({ sites }) => {
      expect(sites).toStrictEqual([{ name: "logo", line: 1 }]);
    });
  });

  describe("a class-like word inside a quoted string", () => {
    const it = test.extend("sites", () =>
      classSitesIn(".mark {\n  content: \".ghost\";\n}\n.tick {\n  content: '.ghost';\n}\n"));

    it("leaves the quoted word out and keeps the surrounding classes", ({ sites }) => {
      expect(sites).toStrictEqual([
        { name: "mark", line: 1 },
        { name: "tick", line: 4 },
      ]);
    });
  });

  describe("a class spelled in two selectors", () => {
    const it = test.extend("sites", () =>
      classSitesIn(".a-b {\n  color: red;\n}\n#panel .a-b {\n  color: blue;\n}\n"));

    it("takes the class once, at the line of its first selector", ({ sites }) => {
      expect(sites).toStrictEqual([{ name: "a-b", line: 1 }]);
    });
  });

  describe("a style sheet that opens no block", () => {
    const it = test.extend("sites", () => classSitesIn('@charset "utf-8";\n'));

    it("yields no class", ({ sites }) => {
      expect(sites).toStrictEqual([]);
    });
  });
});
