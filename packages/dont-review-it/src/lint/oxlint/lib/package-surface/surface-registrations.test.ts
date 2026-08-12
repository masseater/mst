import { describe, expect, test } from "vite-plus/test";

import {
  exemptPackagesFrom,
  importablePackagesFrom,
  runnablePackagesFrom,
} from "./surface-registrations.ts";

const it = test
  .extend("registeredRunnablePackages", () =>
    runnablePackagesFrom([
      {
        runnablePackages: [
          { packageName: "@fixture/cli", reason: "it is invoked from the pipeline" },
          { packageName: "@fixture/task", reason: "it is invoked by hand" },
        ],
      },
    ]))
  .extend("runnablePackagesOfEmptyOptions", () => runnablePackagesFrom([]))
  .extend("runnablePackagesOfForeignOptions", () => runnablePackagesFrom([{ exceptions: [] }]))
  .extend("runnablePackagesOfNamelessEntries", () =>
    runnablePackagesFrom([
      { runnablePackages: [{ reason: "the name was forgotten" }, { packageName: "" }] },
    ]),
  )
  .extend("registeredImportablePackages", () =>
    importablePackagesFrom([
      { importablePackages: [{ packageName: "@fixture/library", reason: "it is a library" }] },
    ]),
  )
  .extend("importablePackagesOfForeignOptions", () => importablePackagesFrom([{}]))
  .extend("packagesExcusedWithReason", () =>
    exemptPackagesFrom([
      { exceptions: [{ packageName: "@fixture/both", reason: "the split lands next release" }] },
    ]),
  )
  .extend("packagesExcusedWithoutReason", () =>
    exemptPackagesFrom([{ exceptions: [{ packageName: "@fixture/both" }] }]),
  )
  .extend("packagesExcusedWithBlankReason", () =>
    exemptPackagesFrom([{ exceptions: [{ packageName: "@fixture/both", reason: "   " }] }]),
  );

describe("runnablePackagesFrom", () => {
  it("reads every package registered as run-only", ({ registeredRunnablePackages }) => {
    expect(registeredRunnablePackages).toStrictEqual(new Set(["@fixture/cli", "@fixture/task"]));
  });

  it("reads nothing when the options carry no registration at all", ({
    runnablePackagesOfEmptyOptions,
  }) => {
    expect(runnablePackagesOfEmptyOptions).toStrictEqual(new Set([]));
  });

  it("reads nothing when the options object leaves the registration out", ({
    runnablePackagesOfForeignOptions,
  }) => {
    expect(runnablePackagesOfForeignOptions).toStrictEqual(new Set([]));
  });

  it("drops an entry that names no package", ({ runnablePackagesOfNamelessEntries }) => {
    expect(runnablePackagesOfNamelessEntries).toStrictEqual(new Set([]));
  });
});

describe("importablePackagesFrom", () => {
  it("reads every package registered as importable", ({ registeredImportablePackages }) => {
    expect(registeredImportablePackages).toStrictEqual(new Set(["@fixture/library"]));
  });

  it("reads nothing when an options object leaves the registration out", ({
    importablePackagesOfForeignOptions,
  }) => {
    expect(importablePackagesOfForeignOptions).toStrictEqual(new Set([]));
  });
});

describe("exemptPackagesFrom", () => {
  it("reads a package excused with a written reason", ({ packagesExcusedWithReason }) => {
    expect(packagesExcusedWithReason).toStrictEqual(new Set(["@fixture/both"]));
  });

  it("does not excuse a package whose reason was left out", ({ packagesExcusedWithoutReason }) => {
    expect(packagesExcusedWithoutReason).toStrictEqual(new Set([]));
  });

  it("does not excuse a package whose reason is blank", ({ packagesExcusedWithBlankReason }) => {
    expect(packagesExcusedWithBlankReason).toStrictEqual(new Set([]));
  });
});
