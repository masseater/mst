import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { assetsReachedBy } from "./reached-assets.ts";

describe("assetsReachedBy", () => {
  describe("a specifier naming test data beside the reader", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("reaches that file", ({ reachedFile }) => {
      expect(reachedFile).toBe(
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
  });

  describe("a specifier naming a relay", () => {
    describe("read for the first time", () => {
      const it = test.extend("reachedFile", () => {
        const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "relay-first");
        rmSync(root, { recursive: true, force: true });
        mkdirSync(join(root, "repo", "owner"), { recursive: true });
        writeFileSync(join(root, "repo", "owner", "order.assets.ts"), "export const rows = [1];\n");
        writeFileSync(
          join(root, "repo", "owner", "relay.ts"),
          'export * from "./order.assets.ts";\n',
        );
        return assetsReachedBy({
          specifier: "./relay.ts",
          fromFile: join(root, "repo", "owner", "reader.test.ts"),
          workspaceRoot: join(root, "repo"),
          markers: new Set(["assets"]),
        });
      });

      it("reaches the test data behind it", ({ reachedFile }) => {
        expect(reachedFile).toBe(
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
    });

    describe("read a second time", () => {
      const it = test.extend("reachedFile", () => {
        const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "relay-second");
        rmSync(root, { recursive: true, force: true });
        mkdirSync(join(root, "repo", "owner"), { recursive: true });
        writeFileSync(join(root, "repo", "owner", "order.assets.ts"), "export const rows = [1];\n");
        writeFileSync(
          join(root, "repo", "owner", "relay.ts"),
          'export * from "./order.assets.ts";\n',
        );
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
      });

      it("reaches the same file", ({ reachedFile }) => {
        expect(reachedFile).toBe(
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
    });
  });

  describe("a module that holds its own declarations", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("reaches no test data", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("files that forward each other in a circle", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("come to an end", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("a file forwarding the reader itself", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("comes to an end", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("data files outside the repository", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("are out of reach", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("data files inside an installed dependency", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("are out of reach", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("a package specifier declared for test data", () => {
    describe("read for the first time", () => {
      const it = test.extend("reachedFile", () => {
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
      });

      it("reaches it", ({ reachedFile }) => {
        expect(reachedFile).toBe(
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
    });

    describe("read a second time", () => {
      const it = test.extend("reachedFile", () => {
        const root = join(
          realpathSync(tmpdir()),
          "dont-review-it-reached-assets",
          "package-second",
        );
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
      });

      it("reaches it on the reading after the first", ({ reachedFile }) => {
        expect(reachedFile).toBe(
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
    });
  });

  describe("a package specifier declared for a module that is absent", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("reaches no test data", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("a path alias standing for a place that holds no module", () => {
    const it = test.extend("reachedFile", () => {
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
    });

    it("reaches no test data", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("a specifier standing for nothing", () => {
    const it = test.extend("reachedFile", () => {
      const root = join(realpathSync(tmpdir()), "dont-review-it-reached-assets", "nowhere");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "repo", "owner"), { recursive: true });
      return assetsReachedBy({
        specifier: "nowhere-at-all",
        fromFile: join(root, "repo", "owner", "reader.test.ts"),
        workspaceRoot: join(root, "repo"),
        markers: new Set(["assets"]),
      });
    });

    it("reaches no test data", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });

  describe("a relative specifier standing for nothing", () => {
    const it = test.extend("reachedFile", () => {
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

    it("reaches no test data", ({ reachedFile }) => {
      expect(reachedFile).toBe(null);
    });
  });
});
