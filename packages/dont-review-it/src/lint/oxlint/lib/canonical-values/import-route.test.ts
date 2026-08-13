import { describe, expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { importRouteStatus } from "./import-route.ts";

describe("importRouteStatus", () => {
  describe("a specifier that is the registered export path", () => {
    const it = test.extend("statusOfTheRegisteredExportPath", () =>
      importRouteStatus(
        {
          specifier: "@mst/order-vocabulary",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("is registered", ({ statusOfTheRegisteredExportPath }) => {
      expect(statusOfTheRegisteredExportPath).toBe("registered");
    });
  });

  describe("a specifier below the registered export path", () => {
    const it = test.extend("statusOfASubpathBelowTheExportPath", () =>
      importRouteStatus(
        {
          specifier: "@mst/order-vocabulary/status",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("is registered", ({ statusOfASubpathBelowTheExportPath }) => {
      expect(statusOfASubpathBelowTheExportPath).toBe("registered");
    });
  });

  describe("a specifier that only starts with the same letters as the export path", () => {
    const it = test.extend("statusOfASpecifierSharingTheOpeningLetters", () =>
      importRouteStatus(
        {
          specifier: "@mst/order-vocabulary-legacy",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("is external rather than registered", ({ statusOfASpecifierSharingTheOpeningLetters }) => {
      expect(statusOfASpecifierSharingTheOpeningLetters).toBe("external");
    });
  });

  describe("a relative specifier that resolves to the registered declaration", () => {
    const it = test.extend("statusOfARelativeSpecifierNamingTheDeclaration", () =>
      importRouteStatus(
        {
          specifier: "./order-status.ts",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("is registered", ({ statusOfARelativeSpecifierNamingTheDeclaration }) => {
      expect(statusOfARelativeSpecifierNamingTheDeclaration).toBe("registered");
    });
  });

  describe("a relative specifier written without an extension", () => {
    const it = test.extend("statusOfARelativeSpecifierWithoutAnExtension", () =>
      importRouteStatus(
        {
          specifier: "./order-status",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("resolves the same way and is registered", ({
      statusOfARelativeSpecifierWithoutAnExtension,
    }) => {
      expect(statusOfARelativeSpecifierWithoutAnExtension).toBe("registered");
    });
  });

  describe("a relative specifier written with the js extension", () => {
    const it = test.extend("statusOfARelativeSpecifierWithTheJsExtension", () =>
      importRouteStatus(
        {
          specifier: "./order-status.js",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("resolves to the ts declaration and is registered", ({
      statusOfARelativeSpecifierWithTheJsExtension,
    }) => {
      expect(statusOfARelativeSpecifierWithTheJsExtension).toBe("registered");
    });
  });

  describe("a relative specifier the catalog does not resolve", () => {
    const it = test.extend("statusOfARelativeSpecifierTheCatalogDoesNotResolve", () =>
      importRouteStatus(
        {
          specifier: "./statuses.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
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
          specifier: "#internal/statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("is unregistered", ({ statusOfASubpathSpecifierTheCatalogDoesNotResolve }) => {
      expect(statusOfASubpathSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
    });
  });

  describe("a subpath specifier the catalog publishes", () => {
    const it = test.extend("statusOfASubpathSpecifierTheCatalogPublishes", () =>
      importRouteStatus(
        {
          specifier: "#internal/statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "#internal/statuses",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("is registered", ({ statusOfASubpathSpecifierTheCatalogPublishes }) => {
      expect(statusOfASubpathSpecifierTheCatalogPublishes).toBe("registered");
    });
  });

  describe("a bare specifier that reaches no registered owner", () => {
    const it = test.extend("statusOfABareSpecifierNoOwnerClaims", () =>
      importRouteStatus(
        {
          specifier: "order-statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("comes from outside the repository", ({ statusOfABareSpecifierNoOwnerClaims }) => {
      expect(statusOfABareSpecifierNoOwnerClaims).toBe("external");
    });
  });

  describe("a declaration reached through an index module", () => {
    const it = test.extend("statusOfADeclarationReachedThroughAnIndexModule", () =>
      importRouteStatus(
        {
          specifier: "./index.ts",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            conceptId: "order.status",
            declarationPath: "packages/order-vocabulary/src/index.ts",
            exportPath: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: "fingerprint-of-draft-and-published",
          },
        ]),
      ));

    it("keeps resolving to its owner and is registered", ({
      statusOfADeclarationReachedThroughAnIndexModule,
    }) => {
      expect(statusOfADeclarationReachedThroughAnIndexModule).toBe("registered");
    });
  });
});
