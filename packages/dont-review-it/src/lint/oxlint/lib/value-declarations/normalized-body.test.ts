import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { normalizedBodyOf } from "./normalized-body.ts";

import type { ImportRoutes } from "./import-routes.ts";

const NO_ROUTES: ImportRoutes = new Map();

const bodyOf = (source: string, routes: ImportRoutes = NO_ROUTES): string =>
  normalizedBodyOf({ body: parseSync("body.ts", source).program.body, routes });

describe("normalizedBodyOf", () => {
  test("gives two bodies that differ only in a parameter name the same spelling", () => {
    expect(bodyOf(`const run = (step) => step * 2;`)).toBe(
      bodyOf(`const run = (count) => count * 2;`),
    );
  });

  test("gives two bodies that differ only in a local name the same spelling", () => {
    expect(bodyOf(`const run = () => { const kept = 1; return kept + kept; };`)).toBe(
      bodyOf(`const run = () => { const held = 1; return held + held; };`),
    );
  });

  test("gives two bodies that differ only in formatting the same spelling", () => {
    expect(bodyOf(`const run = (step) => step * 2;`)).toBe(
      bodyOf(`const run = (\n  step,\n) =>\n  step * 2;`),
    );
  });

  test("keeps two bodies apart when they read a different free name", () => {
    expect(bodyOf(`const run = () => readFileSync("x");`)).not.toBe(
      bodyOf(`const run = () => statSync("x");`),
    );
  });

  test("gives two bodies reading one imported value under different aliases the same spelling", () => {
    const here = bodyOf(
      `const run = () => read("x");`,
      new Map([["read", "node:fs#readFileSync"]]),
    );
    const away = bodyOf(
      `const run = () => slurp("x");`,
      new Map([["slurp", "node:fs#readFileSync"]]),
    );

    expect(here).toBe(away);
  });

  test("keeps two bodies apart when their imported values come from different modules", () => {
    const here = bodyOf(
      `const run = () => read("x");`,
      new Map([["read", "node:fs#readFileSync"]]),
    );
    const away = bodyOf(`const run = () => read("x");`, new Map([["read", "./own#readFileSync"]]));

    expect(here).not.toBe(away);
  });

  test("keeps the written key of a property while renaming the value it holds", () => {
    expect(bodyOf(`const run = (id) => ({ id });`)).toBe(
      bodyOf(`const run = (held) => ({ id: held });`),
    );
  });

  test("keeps two bodies apart when a property is written under a different key", () => {
    expect(bodyOf(`const run = (id) => ({ id });`)).not.toBe(
      bodyOf(`const run = (id) => ({ seed: id });`),
    );
  });

  test("renames a binding read through a computed key", () => {
    expect(bodyOf(`const run = (id) => ({ [id]: 1 });`)).toBe(
      bodyOf(`const run = (held) => ({ [held]: 1 });`),
    );
  });

  test("keeps the written name of a member reached on a renamed binding", () => {
    expect(bodyOf(`const run = (held) => held.size;`)).not.toBe(
      bodyOf(`const run = (held) => held.length;`),
    );
  });

  test("keeps two bodies apart when only a literal differs", () => {
    expect(bodyOf(`const label = () => report("draft");`)).not.toBe(
      bodyOf(`const label = () => report("published");`),
    );
  });
});
