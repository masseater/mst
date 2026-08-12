import { describe, expect, test } from "vite-plus/test";

import { buildCatalog } from "./catalog.ts";
import { importRouteStatus } from "./import-route.ts";

const it = test
  .extend("statusOfTheRegisteredExportPath", () =>
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
    ))
  .extend("statusOfASubpathBelowTheExportPath", () =>
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
    ),
  )
  .extend("statusOfASpecifierSharingTheOpeningLetters", () =>
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
    ),
  )
  .extend("statusOfARelativeSpecifierNamingTheDeclaration", () =>
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
    ),
  )
  .extend("statusOfARelativeSpecifierWithoutAnExtension", () =>
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
    ),
  )
  .extend("statusOfARelativeSpecifierWithTheJsExtension", () =>
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
    ),
  )
  .extend("statusOfARelativeSpecifierTheCatalogDoesNotResolve", () =>
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
    ),
  )
  .extend("statusOfASubpathSpecifierTheCatalogDoesNotResolve", () =>
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
    ),
  )
  .extend("statusOfASubpathSpecifierTheCatalogPublishes", () =>
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
    ),
  )
  .extend("statusOfABareSpecifierNoOwnerClaims", () =>
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
    ),
  )
  .extend("statusOfADeclarationReachedThroughAnIndexModule", () =>
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
    ),
  );

describe("import-route", () => {
  it("a specifier that is the registered export path is registered", ({
    statusOfTheRegisteredExportPath,
  }) => {
    expect(statusOfTheRegisteredExportPath).toBe("registered");
  });

  it("a specifier below the registered export path is registered", ({
    statusOfASubpathBelowTheExportPath,
  }) => {
    expect(statusOfASubpathBelowTheExportPath).toBe("registered");
  });

  it("a specifier that only starts with the same letters as the export path is not registered", ({
    statusOfASpecifierSharingTheOpeningLetters,
  }) => {
    expect(statusOfASpecifierSharingTheOpeningLetters).toBe("external");
  });

  it("a relative specifier that resolves to the registered declaration is registered", ({
    statusOfARelativeSpecifierNamingTheDeclaration,
  }) => {
    expect(statusOfARelativeSpecifierNamingTheDeclaration).toBe("registered");
  });

  it("a relative specifier written without an extension resolves the same way", ({
    statusOfARelativeSpecifierWithoutAnExtension,
  }) => {
    expect(statusOfARelativeSpecifierWithoutAnExtension).toBe("registered");
  });

  it("a relative specifier written with the js extension resolves to the ts declaration", ({
    statusOfARelativeSpecifierWithTheJsExtension,
  }) => {
    expect(statusOfARelativeSpecifierWithTheJsExtension).toBe("registered");
  });

  it("a relative specifier the catalog does not resolve is unregistered", ({
    statusOfARelativeSpecifierTheCatalogDoesNotResolve,
  }) => {
    expect(statusOfARelativeSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
  });

  it("a subpath specifier the catalog does not resolve is unregistered", ({
    statusOfASubpathSpecifierTheCatalogDoesNotResolve,
  }) => {
    expect(statusOfASubpathSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
  });

  it("a subpath specifier the catalog publishes is registered", ({
    statusOfASubpathSpecifierTheCatalogPublishes,
  }) => {
    expect(statusOfASubpathSpecifierTheCatalogPublishes).toBe("registered");
  });

  it("a bare specifier that reaches no registered owner comes from outside the repository", ({
    statusOfABareSpecifierNoOwnerClaims,
  }) => {
    expect(statusOfABareSpecifierNoOwnerClaims).toBe("external");
  });

  it("a declaration reached through an index module keeps resolving to its owner", ({
    statusOfADeclarationReachedThroughAnIndexModule,
  }) => {
    expect(statusOfADeclarationReachedThroughAnIndexModule).toBe("registered");
  });
});
