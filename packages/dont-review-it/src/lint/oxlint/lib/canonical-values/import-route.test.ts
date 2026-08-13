import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { buildCatalog } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { importRouteStatus } from "./import-route.ts";

describe("importRouteStatus", () => {
  describe("a binding the public specifier does not export", () => {
    const it = test.extend("statusOfAShadowBindingOnThePublicSpecifier", () =>
      importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@mst/order-vocabulary",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfAShadowBindingOnThePublicSpecifier }) => {
      expect(statusOfAShadowBindingOnThePublicSpecifier).toBe("unregistered");
    });
  });

  describe("a subpath of a package whose owner publishes another route", () => {
    const it = test.extend("statusOfAnUnregisteredSubpathOfAnOwnedPackage", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary/shadow",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfAnUnregisteredSubpathOfAnOwnedPackage }) => {
      expect(statusOfAnUnregisteredSubpathOfAnOwnedPackage).toBe("unregistered");
    });
  });

  describe("a shadow export of a package that publishes no route at all", () => {
    const it = test.extend("statusOfAShadowExportOfAPackageWithoutPublicRoutes", () =>
      importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@mst/order-vocabulary/shadow",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is still rejected", ({ statusOfAShadowExportOfAPackageWithoutPublicRoutes }) => {
      expect(statusOfAShadowExportOfAPackageWithoutPublicRoutes).toBe("unregistered");
    });
  });

  describe("a repository package the catalog holds no owner declaration for", () => {
    const it = test.extend("statusOfAPackageWithoutAnOwnerDeclaration", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([], { packageNames: ["@mst/order-vocabulary"] }),
      ));

    it("remains unregistered", ({ statusOfAPackageWithoutAnOwnerDeclaration }) => {
      expect(statusOfAPackageWithoutAnOwnerDeclaration).toBe("unregistered");
    });
  });

  describe("a specifier that only starts with the same letters as the export path", () => {
    const it = test.extend("statusOfASpecifierSharingTheOpeningLetters", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary-legacy",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is external rather than registered", ({ statusOfASpecifierSharingTheOpeningLetters }) => {
      expect(statusOfASpecifierSharingTheOpeningLetters).toBe("external");
    });
  });

  describe("a specifier naming a runtime built-in module", () => {
    const it = test.extend("statusOfABuiltinProtocolSpecifier", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "node:fs",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is external", ({ statusOfABuiltinProtocolSpecifier }) => {
      expect(statusOfABuiltinProtocolSpecifier).toBe("external");
    });
  });

  describe("a relative route into a module the source scope ignores", () => {
    const it = test.extend("statusOfARouteIntoAnIgnoredModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-ignored-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status.ts",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog(
          [
            {
              annotationStart: 0,
              binding: "ORDER_STATUSES",
              bindingStart: 40,
              conceptId: "order.status",
              declarationEnd: 80,
              declarationPath: "src/order-status.ts",
              declarationStart: 20,
              importRoutes: [],
              packageName: "@mst/order-vocabulary",
              values: ["draft", "published"],
              fingerprint: fingerprintValues(["draft", "published"]),
            },
          ],
          { sourceScope: { isIgnored: () => true } },
        ),
      );
    });

    it("carries no registered entry", ({ statusOfARouteIntoAnIgnoredModule }) => {
      expect(statusOfARouteIntoAnIgnoredModule).toBe("external");
    });
  });

  describe("a relative owner route written with the ts extension", () => {
    const it = test.extend("statusOfARelativeOwnerRouteWithTheTsExtension", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-relative-ts-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status.ts",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is registered", ({ statusOfARelativeOwnerRouteWithTheTsExtension }) => {
      expect(statusOfARelativeOwnerRouteWithTheTsExtension).toBe("registered");
    });
  });

  describe("a relative owner route written without an extension", () => {
    const it = test.extend("statusOfARelativeOwnerRouteWithoutAnExtension", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-relative-bare-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("resolves the same way and is registered", ({
      statusOfARelativeOwnerRouteWithoutAnExtension,
    }) => {
      expect(statusOfARelativeOwnerRouteWithoutAnExtension).toBe("registered");
    });
  });

  describe("a relative owner route written with the js extension", () => {
    const it = test.extend("statusOfARelativeOwnerRouteWithTheJsExtension", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-relative-js-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status.js",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("resolves to the ts declaration and is registered", ({
      statusOfARelativeOwnerRouteWithTheJsExtension,
    }) => {
      expect(statusOfARelativeOwnerRouteWithTheJsExtension).toBe("registered");
    });
  });

  describe("a binding the relative declaration route does not own", () => {
    const it = test.extend("statusOfANonOwnerBindingOnARelativeDeclarationRoute", ({}, {
      onCleanup,
    }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-relative-binding-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "PUBLIC_STATUSES",
          specifier: "./order-status.ts",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is unregistered", ({ statusOfANonOwnerBindingOnARelativeDeclarationRoute }) => {
      expect(statusOfANonOwnerBindingOnARelativeDeclarationRoute).toBe("unregistered");
    });
  });

  describe("a relative route walking out of a consumer that does not exist", () => {
    const it = test.extend("statusOfARelativeRouteFromAConsumerThatIsNotThere", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "../../order-vocabulary/src/order-status.ts",
          filename: "/repository/packages/consumer/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("cannot claim an owner", ({ statusOfARelativeRouteFromAConsumerThatIsNotThere }) => {
      expect(statusOfARelativeRouteFromAConsumerThatIsNotThere).toBe("unregistered");
    });
  });

  describe("an absolute repository path naming the declaration", () => {
    const it = test.extend("statusOfAnAbsoluteRepositoryPathToTheDeclaration", ({}, {
      onCleanup,
    }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-absolute-owner-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: join(repositoryRoot, "src/order-status.ts"),
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is registered", ({ statusOfAnAbsoluteRepositoryPathToTheDeclaration }) => {
      expect(statusOfAnAbsoluteRepositoryPathToTheDeclaration).toBe("registered");
    });
  });

  describe("a binding the absolute repository path does not own", () => {
    const it = test.extend("statusOfANonOwnerBindingOnAnAbsoluteRepositoryPath", ({}, {
      onCleanup,
    }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-absolute-binding-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "PUBLIC_STATUSES",
          specifier: join(repositoryRoot, "src/order-status.ts"),
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is unregistered", ({ statusOfANonOwnerBindingOnAnAbsoluteRepositoryPath }) => {
      expect(statusOfANonOwnerBindingOnAnAbsoluteRepositoryPath).toBe("unregistered");
    });
  });

  describe("an absolute repository path beside the declaration", () => {
    const it = test.extend("statusOfAnAbsoluteRepositoryPathBesideTheDeclaration", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "/repository/packages/order-vocabulary/src/shadow.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfAnAbsoluteRepositoryPathBesideTheDeclaration }) => {
      expect(statusOfAnAbsoluteRepositoryPathBesideTheDeclaration).toBe("unregistered");
    });
  });

  describe("an absolute path lying outside the repository", () => {
    const it = test.extend("statusOfAnAbsolutePathOutsideTheRepository", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "/vendor/order-status.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is external", ({ statusOfAnAbsolutePathOutsideTheRepository }) => {
      expect(statusOfAnAbsolutePathOutsideTheRepository).toBe("external");
    });
  });

  describe("a configured path alias naming the declaration", () => {
    const it = test.extend("statusOfAPathAliasNamingTheDeclaration", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-owner-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/owner",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("keeps the repository route and is registered", ({
      statusOfAPathAliasNamingTheDeclaration,
    }) => {
      expect(statusOfAPathAliasNamingTheDeclaration).toBe("registered");
    });
  });

  describe("a binding the aliased declaration does not own", () => {
    const it = test.extend("statusOfANonOwnerBindingOnAPathAlias", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-binding-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@internal/owner",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("keeps the binding identity and is unregistered", ({
      statusOfANonOwnerBindingOnAPathAlias,
    }) => {
      expect(statusOfANonOwnerBindingOnAPathAlias).toBe("unregistered");
    });
  });

  describe("a configured path alias naming a sibling of the declaration", () => {
    const it = test.extend("statusOfAPathAliasNamingASiblingModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-sibling-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/shadow": ["packages/order-vocabulary/src/shadow.ts"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/shadow.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/shadow",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is unregistered", ({ statusOfAPathAliasNamingASiblingModule }) => {
      expect(statusOfAPathAliasNamingASiblingModule).toBe("unregistered");
    });
  });

  describe("a configured path alias naming a module that is not there", () => {
    const it = test.extend("statusOfAPathAliasNamingAMissingModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-missing-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/missing": ["packages/missing/statuses.ts"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/missing",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("stays inside the repository and is unregistered", ({
      statusOfAPathAliasNamingAMissingModule,
    }) => {
      expect(statusOfAPathAliasNamingAMissingModule).toBe("unregistered");
    });
  });

  describe("a wildcard path alias naming a module that is not there", () => {
    const it = test.extend("statusOfAWildcardAliasNamingAMissingModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-wildcard-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/missing/*": ["packages/missing/*"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/missing/statuses",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("stays inside the repository and is unregistered", ({
      statusOfAWildcardAliasNamingAMissingModule,
    }) => {
      expect(statusOfAWildcardAliasNamingAMissingModule).toBe("unregistered");
    });
  });

  describe("a specifier no configured path alias matches", () => {
    const it = test.extend("statusOfASpecifierNoPathAliasMatches", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-unmatched-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@vite/unresolved-alias",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is external", ({ statusOfASpecifierNoPathAliasMatches }) => {
      expect(statusOfASpecifierNoPathAliasMatches).toBe("external");
    });
  });

  describe("a bare specifier inside a repository that configures path aliases", () => {
    const it = test.extend("statusOfABareSpecifierBesidePathAliases", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-alias-bare-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages/order-vocabulary/src"), { recursive: true });
      mkdirSync(join(repositoryRoot, "packages/order/src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      writeFileSync(
        join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      writeFileSync(join(repositoryRoot, "packages/order/src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "order-statuses",
          filename: join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is external", ({ statusOfABareSpecifierBesidePathAliases }) => {
      expect(statusOfABareSpecifierBesidePathAliases).toBe("external");
    });
  });

  describe("a path alias a TypeScript config above the repository defines", () => {
    const it = test.extend("statusOfAnAliasDefinedAboveTheRepositoryRoot", ({}, { onCleanup }) => {
      const enclosingDirectory = mkdtempSync(join(tmpdir(), "canonical-values-parent-config-"));
      onCleanup(() => {
        rmSync(enclosingDirectory, { recursive: true, force: true });
      });
      const repositoryRoot = join(enclosingDirectory, "repository");
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(enclosingDirectory, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@external/statuses": ["repository/src/statuses.ts"] },
          },
        }),
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n");
      writeFileSync(
        join(repositoryRoot, "src/statuses.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      const nestedCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@external/statuses",
          filename: join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        nestedCatalog,
      );
    });

    it("cannot redefine a route inside the repository", ({
      statusOfAnAliasDefinedAboveTheRepositoryRoot,
    }) => {
      expect(statusOfAnAliasDefinedAboveTheRepositoryRoot).toBe("external");
    });
  });

  describe("a relative route the TypeScript resolver sends to the ts module", () => {
    const it = test.extend("statusOfARelativeRouteToTheResolvedModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-competing-relative-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "nodenext", moduleResolution: "nodenext" } }),
      );
      writeFileSync(
        join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(
        join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n");
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status.js",
          filename: join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it("is registered", ({ statusOfARelativeRouteToTheResolvedModule }) => {
      expect(statusOfARelativeRouteToTheResolvedModule).toBe("registered");
    });
  });

  describe("a relative route naming the competing extension", () => {
    const it = test.extend("statusOfARelativeRouteToTheCompetingModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-competing-rival-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "nodenext", moduleResolution: "nodenext" } }),
      );
      writeFileSync(
        join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(
        join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n");
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status.jsx",
          filename: join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it("is unregistered", ({ statusOfARelativeRouteToTheCompetingModule }) => {
      expect(statusOfARelativeRouteToTheCompetingModule).toBe("unregistered");
    });
  });

  describe("an absolute route the TypeScript resolver sends to the ts module", () => {
    const it = test.extend("statusOfAnAbsoluteRouteToTheResolvedModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-competing-absolute-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "nodenext", moduleResolution: "nodenext" } }),
      );
      writeFileSync(
        join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(
        join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n");
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: join(repositoryRoot, "src/status.js"),
          filename: join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it("is registered", ({ statusOfAnAbsoluteRouteToTheResolvedModule }) => {
      expect(statusOfAnAbsoluteRouteToTheResolvedModule).toBe("registered");
    });
  });

  describe("an absolute route naming the competing extension", () => {
    const it = test.extend("statusOfAnAbsoluteRouteToTheCompetingModule", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-competing-rival-path-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "nodenext", moduleResolution: "nodenext" } }),
      );
      writeFileSync(
        join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(
        join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n");
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: join(repositoryRoot, "src/status.jsx"),
          filename: join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it("is unregistered", ({ statusOfAnAbsoluteRouteToTheCompetingModule }) => {
      expect(statusOfAnAbsoluteRouteToTheCompetingModule).toBe("unregistered");
    });
  });

  describe("a relative specifier the catalog does not resolve", () => {
    const it = test.extend("statusOfARelativeSpecifierTheCatalogDoesNotResolve", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./statuses.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfARelativeSpecifierTheCatalogDoesNotResolve }) => {
      expect(statusOfARelativeSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
    });
  });

  describe("a subpath specifier the catalog does not resolve", () => {
    const it = test.extend("statusOfASubpathSpecifierTheCatalogDoesNotResolve", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "#internal/statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfASubpathSpecifierTheCatalogDoesNotResolve }) => {
      expect(statusOfASubpathSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
    });
  });

  describe("a subpath specifier the package manifest resolves to a published route", () => {
    const it = test.extend("statusOfAResolvedSubpathImport", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-subpath-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        JSON.stringify({
          imports: { "#internal/statuses": "./src/statuses.ts" },
          name: "@fixture/consumer",
          type: "module",
        }),
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      writeFileSync(join(repositoryRoot, "src/statuses.ts"), "export const ORDER_STATUSES = [];\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "#internal/statuses",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/statuses.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["src/statuses.ts"],
                specifier: "#internal/statuses",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("is registered", ({ statusOfAResolvedSubpathImport }) => {
      expect(statusOfAResolvedSubpathImport).toBe("registered");
    });
  });

  describe("a bare specifier that reaches no registered owner", () => {
    const it = test.extend("statusOfABareSpecifierNoOwnerClaims", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "order-statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("comes from outside the repository", ({ statusOfABareSpecifierNoOwnerClaims }) => {
      expect(statusOfABareSpecifierNoOwnerClaims).toBe("external");
    });
  });

  describe("a declaration reached through an index module", () => {
    const it = test.extend("statusOfADeclarationReachedThroughAnIndexModule", ({}, {
      onCleanup,
    }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-index-module-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/index.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./index.ts",
          filename: join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/index.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it("keeps resolving to its owner and is registered", ({
      statusOfADeclarationReachedThroughAnIndexModule,
    }) => {
      expect(statusOfADeclarationReachedThroughAnIndexModule).toBe("registered");
    });
  });

  describe("a route naming the directory a declaration's index module sits in", () => {
    const it = test.extend("statusOfASiblingRouteBesideADirectoryIndexOwner", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/status/index.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("does not capture the sibling file", ({
      statusOfASiblingRouteBesideADirectoryIndexOwner,
    }) => {
      expect(statusOfASiblingRouteBesideADirectoryIndexOwner).toBe("unregistered");
    });
  });
});
