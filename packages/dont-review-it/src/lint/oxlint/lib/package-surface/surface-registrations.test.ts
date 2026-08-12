import { describe, expect, it } from "vite-plus/test";

import {
  exemptPackagesFrom,
  importablePackagesFrom,
  runnablePackagesFrom,
} from "./surface-registrations.ts";

describe("runnablePackagesFrom", () => {
  it("reads every package registered as run-only", () => {
    expect([
      ...runnablePackagesFrom([
        {
          runnablePackages: [
            { packageName: "@fixture/cli", reason: "it is invoked from the pipeline" },
            { packageName: "@fixture/task", reason: "it is invoked by hand" },
          ],
        },
      ]),
    ]).toStrictEqual(["@fixture/cli", "@fixture/task"]);
  });

  it("reads nothing when the options carry no registration at all", () => {
    expect([...runnablePackagesFrom([])]).toStrictEqual([]);
  });

  it("reads nothing when the options object leaves the registration out", () => {
    expect([...runnablePackagesFrom([{ exceptions: [] }])]).toStrictEqual([]);
  });

  it("drops an entry that names no package", () => {
    expect([
      ...runnablePackagesFrom([
        { runnablePackages: [{ reason: "the name was forgotten" }, { packageName: "" }] },
      ]),
    ]).toStrictEqual([]);
  });
});

describe("importablePackagesFrom", () => {
  it("reads every package registered as importable", () => {
    expect([
      ...importablePackagesFrom([
        { importablePackages: [{ packageName: "@fixture/library", reason: "it is a library" }] },
      ]),
    ]).toStrictEqual(["@fixture/library"]);
  });

  it("reads nothing when the options object leaves the registration out", () => {
    expect([...importablePackagesFrom([{}])]).toStrictEqual([]);
  });
});

describe("exemptPackagesFrom", () => {
  it("reads a package excused with a written reason", () => {
    expect([
      ...exemptPackagesFrom([
        { exceptions: [{ packageName: "@fixture/both", reason: "the split lands next release" }] },
      ]),
    ]).toStrictEqual(["@fixture/both"]);
  });

  it("does not excuse a package whose reason was left out", () => {
    expect([
      ...exemptPackagesFrom([{ exceptions: [{ packageName: "@fixture/both" }] }]),
    ]).toStrictEqual([]);
  });

  it("does not excuse a package whose reason is blank", () => {
    expect([
      ...exemptPackagesFrom([{ exceptions: [{ packageName: "@fixture/both", reason: "   " }] }]),
    ]).toStrictEqual([]);
  });
});
