import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { assetsReachedBy } from "./reached-assets.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-reached-assets");
rmSync(fixtureDir, { recursive: true, force: true });

const fixturePath = (name: string): string => join(fixtureDir, name);

const writeFixture = (name: string, source: string): string => {
  const path = fixturePath(name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

const workspaceRoot = fixturePath("repo");

const markers: ReadonlySet<string> = new Set(["assets"]);

const readerPath = fixturePath("repo/owner/reader.test.ts");

const reachedFrom = (specifier: string): string | null =>
  assetsReachedBy({ specifier, fromFile: readerPath, workspaceRoot, markers });

writeFixture("repo/owner/order.assets.ts", "export const rows = [1];\n");
writeFixture("repo/owner/plain.ts", "export const total = 1;\n");
writeFixture("repo/owner/relay.ts", 'export * from "./order.assets.ts";\n');
writeFixture("repo/owner/loop-a.ts", 'export * from "./loop-b.ts";\n');
writeFixture("repo/owner/loop-b.ts", 'export * from "./loop-a.ts";\n');
writeFixture("repo/owner/back.ts", 'export * from "./reader.test.ts";\n');
writeFixture("repo/node_modules/dep/order.assets.ts", "export const rows = [2];\n");
writeFixture("outside/order.assets.ts", "export const rows = [3];\n");
writeFixture(
  "repo/aliased/tsconfig.json",
  JSON.stringify({ compilerOptions: { paths: { "@data/*": ["./absent/*"] } } }),
);

writeFixture(
  "repo/packages/shared/package.json",
  JSON.stringify({
    name: "@fixture/shared",
    exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
  }),
);
writeFixture("repo/packages/shared/src/table.assets.ts", "export const table = [4];\n");
mkdirSync(fixturePath("repo/node_modules/@fixture"), { recursive: true });
symlinkSync(
  fixturePath("repo/packages/shared"),
  fixturePath("repo/node_modules/@fixture/shared"),
  "dir",
);

describe("reached-assets", () => {
  test("a specifier naming test data beside the reader reaches that file", () => {
    expect(reachedFrom("./order.assets.ts")).toBe(fixturePath("repo/owner/order.assets.ts"));
  });

  test("the same specifier reaches the same file on a second reading", () => {
    expect(reachedFrom("./relay.ts")).toBe(fixturePath("repo/owner/order.assets.ts"));
    expect(reachedFrom("./relay.ts")).toBe(fixturePath("repo/owner/order.assets.ts"));
  });

  test("a module that holds its own declarations reaches no test data", () => {
    expect(reachedFrom("./plain.ts")).toBe(null);
  });

  test("files that forward each other in a circle come to an end", () => {
    expect(reachedFrom("./loop-a.ts")).toBe(null);
  });

  test("a file forwarding the reader itself comes to an end", () => {
    expect(reachedFrom("./back.ts")).toBe(null);
  });

  test("data files outside the repository are out of reach", () => {
    expect(reachedFrom("../../outside/order.assets.ts")).toBe(null);
  });

  test("data files inside an installed dependency are out of reach", () => {
    expect(reachedFrom("../node_modules/dep/order.assets.ts")).toBe(null);
  });

  test("a package specifier declared for test data reaches it, on the first reading and the next", () => {
    expect(reachedFrom("@fixture/shared/data")).toBe(
      fixturePath("repo/packages/shared/src/table.assets.ts"),
    );
    expect(reachedFrom("@fixture/shared/data")).toBe(
      fixturePath("repo/packages/shared/src/table.assets.ts"),
    );
  });

  test("a package specifier declared for a module that is absent reaches no test data", () => {
    expect(reachedFrom("@fixture/shared/gone")).toBe(null);
  });

  test("a path alias standing for a place that holds no module reaches no test data", () => {
    expect(
      assetsReachedBy({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("repo/aliased/reader.test.ts"),
        workspaceRoot,
        markers,
      }),
    ).toBe(null);
  });

  test("a specifier standing for nothing reaches no test data", () => {
    expect(reachedFrom("nowhere-at-all")).toBe(null);
    expect(reachedFrom("./absent.ts")).toBe(null);
  });
});
