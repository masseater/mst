import { describe, expect, test } from "vite-plus/test";

import { classSitesIn } from "./stylesheet-classes.ts";

describe("classSitesIn", () => {
  test("a class selector is taken with the line it stands on", () => {
    expect(classSitesIn("body {\n  margin: 0;\n}\n\n.counter {\n  color: red;\n}\n")).toStrictEqual(
      [{ name: "counter", line: 5 }],
    );
  });

  test("a class nested in an at-rule is taken and the at-rule prelude is left out", () => {
    expect(
      classSitesIn("@media (max-width: 1024px) {\n  .wide {\n    color: red;\n  }\n}\n"),
    ).toStrictEqual([{ name: "wide", line: 2 }]);
  });

  test("a class-like word inside a comment is left out and the lines after it stay put", () => {
    expect(classSitesIn("/*\n .ghost\n*/\n.real {\n  color: red;\n}\n")).toStrictEqual([
      { name: "real", line: 4 },
    ]);
  });

  test("a class-like word inside an unquoted url is left out", () => {
    expect(classSitesIn(".logo {\n  background: url(./hero.png);\n}\n")).toStrictEqual([
      { name: "logo", line: 1 },
    ]);
  });

  test("a class-like word inside a quoted string is left out", () => {
    expect(
      classSitesIn(".mark {\n  content: \".ghost\";\n}\n.tick {\n  content: '.ghost';\n}\n"),
    ).toStrictEqual([
      { name: "mark", line: 1 },
      { name: "tick", line: 4 },
    ]);
  });

  test("a class spelled in two selectors is taken once", () => {
    expect(
      classSitesIn(".a-b {\n  color: red;\n}\n#panel .a-b {\n  color: blue;\n}\n"),
    ).toStrictEqual([{ name: "a-b", line: 1 }]);
  });

  test("a style sheet that opens no block yields no class", () => {
    expect(classSitesIn('@charset "utf-8";\n')).toStrictEqual([]);
  });
});
