import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { boundNamesIn } from "./bound-names.ts";

const namesBoundIn = (source: string): readonly string[] =>
  [...boundNamesIn(parseSync("bound.ts", source).program.body)].toSorted();

describe("boundNamesIn", () => {
  test("takes the parameters of an arrow", () => {
    expect(namesBoundIn(`const run = (step, count) => step + count;`)).toStrictEqual([
      "count",
      "run",
      "step",
    ]);
  });

  test("takes the name and the parameters of a function declaration", () => {
    expect(namesBoundIn(`function run(step) { return step; }`)).toStrictEqual(["run", "step"]);
  });

  test("takes the name of a class and of the bindings inside it", () => {
    expect(namesBoundIn(`class Owner { run(step) { return step; } }`)).toStrictEqual([
      "Owner",
      "step",
    ]);
  });

  test("takes the pieces a parameter is destructured into", () => {
    expect(namesBoundIn(`const run = ({ id, seeds: [first, ...rest] = [] }) => id;`)).toStrictEqual(
      ["first", "id", "rest", "run"],
    );
  });

  test("takes the binding a failure is caught into", () => {
    expect(namesBoundIn(`try { run(); } catch (failure) { report(failure); }`)).toStrictEqual([
      "failure",
    ]);
  });

  test("takes the type parameter a declaration is written over", () => {
    expect(namesBoundIn(`const run = <Held,>(held: Held) => held;`)).toStrictEqual([
      "Held",
      "held",
      "run",
    ]);
  });

  test("leaves the type a parameter is annotated with out of the bindings", () => {
    expect(namesBoundIn(`const run = ({ id }: Held) => id;`)).toStrictEqual(["id", "run"]);
  });

  test("leaves a name that is only read out of the bindings", () => {
    expect(namesBoundIn(`report(readFileSync("x"));`)).toStrictEqual([]);
  });
});
