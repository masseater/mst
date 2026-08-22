import { describe, expect, test } from "vite-plus/test";

import {
  exemptPackagesFrom,
  importablePackagesFrom,
  runnablePackagesFrom,
} from "./surface-registrations.ts";

describe("runnablePackagesFrom", () => {
  describe("options registering two packages as run-only", () => {
    const it = test.extend("registeredRunnablePackages", () =>
      runnablePackagesFrom([
        {
          runnablePackages: [
            { packageName: "@fixture/cli", reason: "it is invoked from the pipeline" },
            { packageName: "@fixture/task", reason: "it is invoked by hand" },
          ],
        },
      ]));

    it("reads every package the registration names", ({ registeredRunnablePackages }) => {
      expect(registeredRunnablePackages).toStrictEqual(new Set(["@fixture/cli", "@fixture/task"]));
    });
  });

  describe("options carrying no registration at all", () => {
    const it = test.extend("runnablePackagesOfEmptyOptions", () => runnablePackagesFrom([]));

    it("reads nothing", ({ runnablePackagesOfEmptyOptions }) => {
      expect(runnablePackagesOfEmptyOptions).toStrictEqual(new Set());
    });
  });

  describe("an options object that leaves the registration out", () => {
    const it = test.extend("runnablePackagesOfForeignOptions", () =>
      runnablePackagesFrom([{ exceptions: [] }]));

    it("reads nothing", ({ runnablePackagesOfForeignOptions }) => {
      expect(runnablePackagesOfForeignOptions).toStrictEqual(new Set());
    });
  });

  describe("entries that name no package", () => {
    const it = test.extend("runnablePackagesOfNamelessEntries", () =>
      runnablePackagesFrom([
        { runnablePackages: [{ reason: "the name was forgotten" }, { packageName: "" }] },
      ]));

    it("drops every one of them", ({ runnablePackagesOfNamelessEntries }) => {
      expect(runnablePackagesOfNamelessEntries).toStrictEqual(new Set());
    });
  });
});

describe("importablePackagesFrom", () => {
  describe("options registering a package as importable", () => {
    const it = test.extend("registeredImportablePackages", () =>
      importablePackagesFrom([
        { importablePackages: [{ packageName: "@fixture/library", reason: "it is a library" }] },
      ]));

    it("reads every package the registration names", ({ registeredImportablePackages }) => {
      expect(registeredImportablePackages).toStrictEqual(new Set(["@fixture/library"]));
    });
  });

  describe("an options object that leaves the registration out", () => {
    const it = test.extend("importablePackagesOfForeignOptions", () =>
      importablePackagesFrom([{}]));

    it("reads nothing", ({ importablePackagesOfForeignOptions }) => {
      expect(importablePackagesOfForeignOptions).toStrictEqual(new Set());
    });
  });
});

describe("exemptPackagesFrom", () => {
  describe("a package excused with a written reason", () => {
    const it = test.extend("packagesExcusedWithReason", () =>
      exemptPackagesFrom([
        { exceptions: [{ packageName: "@fixture/both", reason: "the split lands next release" }] },
      ]));

    it("is excused", ({ packagesExcusedWithReason }) => {
      expect(packagesExcusedWithReason).toStrictEqual(new Set(["@fixture/both"]));
    });
  });

  describe("a package whose reason was left out", () => {
    const it = test.extend("packagesExcusedWithoutReason", () =>
      exemptPackagesFrom([{ exceptions: [{ packageName: "@fixture/both" }] }]));

    it("is not excused", ({ packagesExcusedWithoutReason }) => {
      expect(packagesExcusedWithoutReason).toStrictEqual(new Set());
    });
  });

  describe("a package whose reason is blank", () => {
    const it = test.extend("packagesExcusedWithBlankReason", () =>
      exemptPackagesFrom([{ exceptions: [{ packageName: "@fixture/both", reason: "   " }] }]));

    it("is not excused", ({ packagesExcusedWithBlankReason }) => {
      expect(packagesExcusedWithBlankReason).toStrictEqual(new Set());
    });
  });
});
