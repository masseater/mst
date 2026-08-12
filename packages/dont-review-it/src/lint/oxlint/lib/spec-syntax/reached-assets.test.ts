import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { assetsReachedBy } from "./reached-assets.ts";

const it = test
  .extend("assetsReachedByASpecifierNamingTestDataBesideTheReader", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "beside");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    writeFileSync(join(root, "repo", "owner", "order.assets.ts"), "export const rows = [1];\n");
    return assetsReachedBy({
      specifier: "./order.assets.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedThroughARelayOnTheFirstReading", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "relay-first");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    writeFileSync(join(root, "repo", "owner", "order.assets.ts"), "export const rows = [1];\n");
    writeFileSync(join(root, "repo", "owner", "relay.ts"), 'export * from "./order.assets.ts";\n');
    return assetsReachedBy({
      specifier: "./relay.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedThroughARelayOnTheSecondReading", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "relay-second");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    writeFileSync(join(root, "repo", "owner", "order.assets.ts"), "export const rows = [1];\n");
    writeFileSync(join(root, "repo", "owner", "relay.ts"), 'export * from "./order.assets.ts";\n');
    assetsReachedBy({
      specifier: "./relay.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
    return assetsReachedBy({
      specifier: "./relay.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByAModuleHoldingItsOwnDeclarations", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "plain");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    writeFileSync(join(root, "repo", "owner", "plain.ts"), "export const total = 1;\n");
    return assetsReachedBy({
      specifier: "./plain.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedThroughFilesThatForwardEachOtherInACircle", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "circle");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    writeFileSync(join(root, "repo", "owner", "loop-a.ts"), 'export * from "./loop-b.ts";\n');
    writeFileSync(join(root, "repo", "owner", "loop-b.ts"), 'export * from "./loop-a.ts";\n');
    return assetsReachedBy({
      specifier: "./loop-a.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedThroughAFileForwardingTheReaderItself", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "back");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    writeFileSync(join(root, "repo", "owner", "back.ts"), 'export * from "./reader.test.ts";\n');
    return assetsReachedBy({
      specifier: "./back.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByASpecifierNamingAFileOutsideTheRepository", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "outside");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    mkdirSync(join(root, "outside"), { recursive: true });
    writeFileSync(join(root, "outside", "order.assets.ts"), "export const rows = [3];\n");
    return assetsReachedBy({
      specifier: "../../outside/order.assets.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByASpecifierNamingAFileInsideAnInstalledDependency", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "installed");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    mkdirSync(join(root, "repo", "node_modules", "dep"), { recursive: true });
    writeFileSync(
      join(root, "repo", "node_modules", "dep", "order.assets.ts"),
      "export const rows = [2];\n",
    );
    return assetsReachedBy({
      specifier: "../node_modules/dep/order.assets.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByAPackageSpecifierOnTheFirstReading", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "package-first");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    mkdirSync(join(root, "repo", "packages", "shared", "src"), { recursive: true });
    writeFileSync(
      join(root, "repo", "packages", "shared", "package.json"),
      JSON.stringify({
        name: "@fixture/shared",
        exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
      }),
    );
    writeFileSync(
      join(root, "repo", "packages", "shared", "src", "table.assets.ts"),
      "export const table = [4];\n",
    );
    mkdirSync(join(root, "repo", "node_modules", "@fixture"), { recursive: true });
    symlinkSync(
      join(root, "repo", "packages", "shared"),
      join(root, "repo", "node_modules", "@fixture", "shared"),
      "dir",
    );
    return assetsReachedBy({
      specifier: "@fixture/shared/data",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByAPackageSpecifierOnTheSecondReading", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "package-second");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    mkdirSync(join(root, "repo", "packages", "shared", "src"), { recursive: true });
    writeFileSync(
      join(root, "repo", "packages", "shared", "package.json"),
      JSON.stringify({
        name: "@fixture/shared",
        exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
      }),
    );
    writeFileSync(
      join(root, "repo", "packages", "shared", "src", "table.assets.ts"),
      "export const table = [4];\n",
    );
    mkdirSync(join(root, "repo", "node_modules", "@fixture"), { recursive: true });
    symlinkSync(
      join(root, "repo", "packages", "shared"),
      join(root, "repo", "node_modules", "@fixture", "shared"),
      "dir",
    );
    assetsReachedBy({
      specifier: "@fixture/shared/data",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
    return assetsReachedBy({
      specifier: "@fixture/shared/data",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByAPackageSpecifierStandingForAnAbsentModule", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "package-gone");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    mkdirSync(join(root, "repo", "packages", "shared", "src"), { recursive: true });
    writeFileSync(
      join(root, "repo", "packages", "shared", "package.json"),
      JSON.stringify({
        name: "@fixture/shared",
        exports: { "./data": "./src/table.assets.ts", "./gone": "./src/gone.ts" },
      }),
    );
    writeFileSync(
      join(root, "repo", "packages", "shared", "src", "table.assets.ts"),
      "export const table = [4];\n",
    );
    mkdirSync(join(root, "repo", "node_modules", "@fixture"), { recursive: true });
    symlinkSync(
      join(root, "repo", "packages", "shared"),
      join(root, "repo", "node_modules", "@fixture", "shared"),
      "dir",
    );
    return assetsReachedBy({
      specifier: "@fixture/shared/gone",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByAPathAliasStandingForAPlaceHoldingNoModule", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "aliased");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "aliased"), { recursive: true });
    writeFileSync(
      join(root, "repo", "aliased", "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@data/*": ["./absent/*"] } } }),
    );
    return assetsReachedBy({
      specifier: "@data/order.assets.ts",
      fromFile: join(root, "repo", "aliased", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByASpecifierStandingForNothing", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "nowhere");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    return assetsReachedBy({
      specifier: "nowhere-at-all",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  })
  .extend("assetsReachedByARelativeSpecifierStandingForNothing", () => {
    const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "absent");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, "repo", "owner"), { recursive: true });
    return assetsReachedBy({
      specifier: "./absent.ts",
      fromFile: join(root, "repo", "owner", "reader.test.ts"),
      workspaceRoot: join(root, "repo"),
      markers: new Set(["assets"]),
    });
  });

describe("reached-assets", () => {
  it("a specifier naming test data beside the reader reaches that file", ({
    assetsReachedByASpecifierNamingTestDataBesideTheReader,
  }) => {
    expect(assetsReachedByASpecifierNamingTestDataBesideTheReader).toBe(
      join(
        realpathSync(tmpdir()),
        "dont-review-it-reached-assets",
        "beside",
        "repo",
        "owner",
        "order.assets.ts",
      ),
    );
  });

  it("a specifier naming a relay reaches the test data behind it", ({
    assetsReachedThroughARelayOnTheFirstReading,
  }) => {
    expect(assetsReachedThroughARelayOnTheFirstReading).toBe(
      join(
        realpathSync(tmpdir()),
        "dont-review-it-reached-assets",
        "relay-first",
        "repo",
        "owner",
        "order.assets.ts",
      ),
    );
  });

  it("the same specifier reaches the same file on a second reading", ({
    assetsReachedThroughARelayOnTheSecondReading,
  }) => {
    expect(assetsReachedThroughARelayOnTheSecondReading).toBe(
      join(
        realpathSync(tmpdir()),
        "dont-review-it-reached-assets",
        "relay-second",
        "repo",
        "owner",
        "order.assets.ts",
      ),
    );
  });

  it("a module that holds its own declarations reaches no test data", ({
    assetsReachedByAModuleHoldingItsOwnDeclarations,
  }) => {
    expect(assetsReachedByAModuleHoldingItsOwnDeclarations).toBe(null);
  });

  it("files that forward each other in a circle come to an end", ({
    assetsReachedThroughFilesThatForwardEachOtherInACircle,
  }) => {
    expect(assetsReachedThroughFilesThatForwardEachOtherInACircle).toBe(null);
  });

  it("a file forwarding the reader itself comes to an end", ({
    assetsReachedThroughAFileForwardingTheReaderItself,
  }) => {
    expect(assetsReachedThroughAFileForwardingTheReaderItself).toBe(null);
  });

  it("data files outside the repository are out of reach", ({
    assetsReachedByASpecifierNamingAFileOutsideTheRepository,
  }) => {
    expect(assetsReachedByASpecifierNamingAFileOutsideTheRepository).toBe(null);
  });

  it("data files inside an installed dependency are out of reach", ({
    assetsReachedByASpecifierNamingAFileInsideAnInstalledDependency,
  }) => {
    expect(assetsReachedByASpecifierNamingAFileInsideAnInstalledDependency).toBe(null);
  });

  it("a package specifier declared for test data reaches it", ({
    assetsReachedByAPackageSpecifierOnTheFirstReading,
  }) => {
    expect(assetsReachedByAPackageSpecifierOnTheFirstReading).toBe(
      join(
        realpathSync(tmpdir()),
        "dont-review-it-reached-assets",
        "package-first",
        "repo",
        "packages",
        "shared",
        "src",
        "table.assets.ts",
      ),
    );
  });

  it("a package specifier declared for test data reaches it on the reading after the first", ({
    assetsReachedByAPackageSpecifierOnTheSecondReading,
  }) => {
    expect(assetsReachedByAPackageSpecifierOnTheSecondReading).toBe(
      join(
        realpathSync(tmpdir()),
        "dont-review-it-reached-assets",
        "package-second",
        "repo",
        "packages",
        "shared",
        "src",
        "table.assets.ts",
      ),
    );
  });

  it("a package specifier declared for a module that is absent reaches no test data", ({
    assetsReachedByAPackageSpecifierStandingForAnAbsentModule,
  }) => {
    expect(assetsReachedByAPackageSpecifierStandingForAnAbsentModule).toBe(null);
  });

  it("a path alias standing for a place that holds no module reaches no test data", ({
    assetsReachedByAPathAliasStandingForAPlaceHoldingNoModule,
  }) => {
    expect(assetsReachedByAPathAliasStandingForAPlaceHoldingNoModule).toBe(null);
  });

  it("a specifier standing for nothing reaches no test data", ({
    assetsReachedByASpecifierStandingForNothing,
  }) => {
    expect(assetsReachedByASpecifierStandingForNothing).toBe(null);
  });

  it("a relative specifier standing for nothing reaches no test data", ({
    assetsReachedByARelativeSpecifierStandingForNothing,
  }) => {
    expect(assetsReachedByARelativeSpecifierStandingForNothing).toBe(null);
  });
});
