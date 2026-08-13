import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  packageDirectoryInWorkspace,
  packageReferenceOf,
  resolveCoupling,
} from "./specifier-resolution.ts";

const WORKSPACE_STEM = "setup-modules-specifier-workspace-";

describe("packageReferenceOf", () => {
  describe("a scope written without a package name", () => {
    const it = test.extend("referenceOfBareScope", () => packageReferenceOf("@fixture"));

    it("references no package", ({ referenceOfBareScope }) => {
      expect(referenceOfBareScope).toBe(null);
    });
  });

  describe("a package written with a subpath", () => {
    const it = test.extend("referenceOfScopedSubpath", () =>
      packageReferenceOf("@fixture/shared/http"));

    it("references that subpath", ({ referenceOfScopedSubpath }) => {
      expect(referenceOfScopedSubpath).toStrictEqual({
        name: "@fixture/shared",
        subpath: "./http",
      });
    });
  });
});

describe("packageDirectoryInWorkspace", () => {
  describe("a specifier naming no package", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("directoryOfBareScope", ({ workspaceRoot }) =>
        packageDirectoryInWorkspace({
          specifier: "@fixture",
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        }),
      );

    it("resolves to no package directory", ({ directoryOfBareScope }) => {
      expect(directoryOfBareScope).toBe(null);
    });
  });

  describe("a package installed as a copy of its own", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("directoryOfVendoredCopy", ({ workspaceRoot }) => {
        const installed = join(workspaceRoot, "node_modules", "vendored");
        mkdirSync(installed, { recursive: true });
        writeFileSync(join(installed, "package.json"), '{"name":"vendored"}');
        return packageDirectoryInWorkspace({
          specifier: "vendored",
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });

    it("is outside the workspace source", ({ directoryOfVendoredCopy }) => {
      expect(directoryOfVendoredCopy).toBe(null);
    });
  });

  describe("a package linked from outside the workspace", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("directoryOfPackageLinkedFromOutside", ({ workspaceRoot }, { onCleanup }) => {
        const outside = mkdtempSync(join(tmpdir(), "setup-modules-specifier-outside-"));
        onCleanup(() => {
          rmSync(outside, { recursive: true, force: true });
        });
        writeFileSync(join(outside, "package.json"), '{"name":"outsider"}');
        const link = join(workspaceRoot, "node_modules", "outsider");
        mkdirSync(join(link, ".."), { recursive: true });
        symlinkSync(outside, link, "dir");
        return packageDirectoryInWorkspace({
          specifier: "outsider",
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });

    it("is not read as workspace source", ({ directoryOfPackageLinkedFromOutside }) => {
      expect(directoryOfPackageLinkedFromOutside).toBe(null);
    });
  });
});

describe("resolveCoupling", () => {
  describe("a specifier written as an absolute path", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("couplingOfAbsoluteSpecifier", ({ workspaceRoot }) => {
        const held = join(workspaceRoot, "held.ts");
        writeFileSync(held, "export const held = 1;\n");
        return resolveCoupling({
          specifier: held,
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });

    it("is left unresolved", ({ couplingOfAbsoluteSpecifier }) => {
      expect(couplingOfAbsoluteSpecifier).toBe(null);
    });
  });

  describe("a relative specifier written without an extension", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("couplingOfExtensionlessSpecifier", ({ workspaceRoot }) => {
        writeFileSync(join(workspaceRoot, "held.ts"), "export const held = 1;\n");
        return resolveCoupling({
          specifier: "./held",
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });

    it("resolves to the module beside it", ({
      couplingOfExtensionlessSpecifier,
      workspaceRoot,
    }) => {
      expect(couplingOfExtensionlessSpecifier).toStrictEqual({
        kind: "repositoryFile",
        path: join(workspaceRoot, "held.ts"),
      });
    });
  });

  describe("a relative specifier written with a built extension", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("couplingOfBuiltExtensionSpecifier", ({ workspaceRoot }) => {
        writeFileSync(join(workspaceRoot, "held.ts"), "export const held = 1;\n");
        return resolveCoupling({
          specifier: "./held.js",
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });

    it("resolves to the source beside it", ({
      couplingOfBuiltExtensionSpecifier,
      workspaceRoot,
    }) => {
      expect(couplingOfBuiltExtensionSpecifier).toStrictEqual({
        kind: "repositoryFile",
        path: join(workspaceRoot, "held.ts"),
      });
    });
  });

  describe("a relative specifier naming a directory", () => {
    const it = test
      .extend("workspaceRoot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("couplingOfDirectorySpecifier", ({ workspaceRoot }) => {
        mkdirSync(join(workspaceRoot, "held"));
        writeFileSync(join(workspaceRoot, "held", "index.ts"), "export const held = 1;\n");
        return resolveCoupling({
          specifier: "./held",
          fromFile: join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });

    it("resolves to the index inside it", ({ couplingOfDirectorySpecifier, workspaceRoot }) => {
      expect(couplingOfDirectorySpecifier).toStrictEqual({
        kind: "repositoryFile",
        path: join(workspaceRoot, "held", "index.ts"),
      });
    });
  });
});
