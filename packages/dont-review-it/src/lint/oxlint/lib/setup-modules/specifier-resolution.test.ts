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

const it = test
  .extend("workspaceRoot", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), WORKSPACE_STEM));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  })
  .extend("referenceOfBareScope", () => packageReferenceOf("@fixture"))
  .extend("referenceOfScopedSubpath", () => packageReferenceOf("@fixture/shared/http"))
  .extend("directoryOfBareScope", ({ workspaceRoot }) =>
    packageDirectoryInWorkspace({
      specifier: "@fixture",
      fromFile: join(workspaceRoot, "spec.test.ts"),
      workspaceRoot,
    }),
  )
  .extend("directoryOfVendoredCopy", ({ workspaceRoot }) => {
    const installed = join(workspaceRoot, "node_modules", "vendored");
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, "package.json"), '{"name":"vendored"}');
    return packageDirectoryInWorkspace({
      specifier: "vendored",
      fromFile: join(workspaceRoot, "spec.test.ts"),
      workspaceRoot,
    });
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
  })
  .extend("couplingOfAbsoluteSpecifier", ({ workspaceRoot }) => {
    const held = join(workspaceRoot, "held.ts");
    writeFileSync(held, "export const held = 1;\n");
    return resolveCoupling({
      specifier: held,
      fromFile: join(workspaceRoot, "spec.test.ts"),
      workspaceRoot,
    });
  })
  .extend("couplingOfExtensionlessSpecifier", ({ workspaceRoot }) => {
    writeFileSync(join(workspaceRoot, "held.ts"), "export const held = 1;\n");
    return resolveCoupling({
      specifier: "./held",
      fromFile: join(workspaceRoot, "spec.test.ts"),
      workspaceRoot,
    });
  })
  .extend("couplingOfBuiltExtensionSpecifier", ({ workspaceRoot }) => {
    writeFileSync(join(workspaceRoot, "held.ts"), "export const held = 1;\n");
    return resolveCoupling({
      specifier: "./held.js",
      fromFile: join(workspaceRoot, "spec.test.ts"),
      workspaceRoot,
    });
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

describe("setup-modules/specifier-resolution", () => {
  it("a scope written without a package name references no package", ({ referenceOfBareScope }) => {
    expect(referenceOfBareScope).toBe(null);
  });

  it("a package written with a subpath references that subpath", ({ referenceOfScopedSubpath }) => {
    expect(referenceOfScopedSubpath).toStrictEqual({
      name: "@fixture/shared",
      subpath: "./http",
    });
  });

  it("a specifier naming no package resolves to no package directory", ({
    directoryOfBareScope,
  }) => {
    expect(directoryOfBareScope).toBe(null);
  });

  it("a package installed as a copy of its own is outside the workspace source", ({
    directoryOfVendoredCopy,
  }) => {
    expect(directoryOfVendoredCopy).toBe(null);
  });

  it("a package linked from outside the workspace is not read as workspace source", ({
    directoryOfPackageLinkedFromOutside,
  }) => {
    expect(directoryOfPackageLinkedFromOutside).toBe(null);
  });

  it("a specifier written as an absolute path is left unresolved", ({
    couplingOfAbsoluteSpecifier,
  }) => {
    expect(couplingOfAbsoluteSpecifier).toBe(null);
  });

  it("a relative specifier written without an extension resolves to the module beside it", ({
    couplingOfExtensionlessSpecifier,
    workspaceRoot,
  }) => {
    expect(couplingOfExtensionlessSpecifier).toStrictEqual({
      kind: "repositoryFile",
      path: join(workspaceRoot, "held.ts"),
    });
  });

  it("a relative specifier written with a built extension resolves to the source beside it", ({
    couplingOfBuiltExtensionSpecifier,
    workspaceRoot,
  }) => {
    expect(couplingOfBuiltExtensionSpecifier).toStrictEqual({
      kind: "repositoryFile",
      path: join(workspaceRoot, "held.ts"),
    });
  });

  it("a relative specifier naming a directory resolves to the index inside it", ({
    couplingOfDirectorySpecifier,
    workspaceRoot,
  }) => {
    expect(couplingOfDirectorySpecifier).toStrictEqual({
      kind: "repositoryFile",
      path: join(workspaceRoot, "held", "index.ts"),
    });
  });
});
