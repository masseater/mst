import { describe, expect, test } from "vite-plus/test";

import {
  carriesGrounds,
  exceptionsCovering,
  specifierExceptionsIn,
} from "./specifier-exceptions.ts";

const REPOSITORY_ROOT = "/repo";

const HOST_PATH = "apps/host/**";

const HOST_REASON = "the candidates arrive as settings";

const it = test
  .extend("registeredHostException", () =>
    specifierExceptionsIn([{ exceptions: [{ path: HOST_PATH, reason: HOST_REASON }] }]))
  .extend("groundsOfSpacedReason", () =>
    specifierExceptionsIn([{ exceptions: [{ path: HOST_PATH, reason: "  " }] }]).map((exception) =>
      carriesGrounds(exception),
    ),
  )
  .extend("groundsOfMissingReason", () =>
    specifierExceptionsIn([{ exceptions: [{ path: HOST_PATH }] }]).map((exception) =>
      carriesGrounds(exception),
    ),
  )
  .extend("registeredPathlessException", () =>
    specifierExceptionsIn([{ exceptions: [{ reason: HOST_REASON }] }]),
  )
  .extend("registeredNonRecordEntries", () =>
    specifierExceptionsIn([{ exceptions: [HOST_PATH, null, []] }]),
  )
  .extend("registeredFromUnlistedExceptions", () =>
    specifierExceptionsIn([{ exceptions: HOST_PATH }]),
  )
  .extend("registeredFromNonRecordOptions", () => specifierExceptionsIn([[HOST_PATH]]))
  .extend("registeredFromAbsentOptions", () => specifierExceptionsIn([]))
  .extend("exceptionsOverReachedFile", () =>
    exceptionsCovering({
      exceptions: [{ path: HOST_PATH, reason: HOST_REASON }],
      pathSegments: ["repo", "apps", "host", "loader.ts"],
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("exceptionsOverMissedFile", () =>
    exceptionsCovering({
      exceptions: [{ path: HOST_PATH, reason: HOST_REASON }],
      pathSegments: ["repo", "apps", "site", "loader.ts"],
      cwd: REPOSITORY_ROOT,
    }),
  );

describe("specifier-exceptions", () => {
  it("an entry names the path it covers and the grounds it carries", ({
    registeredHostException,
  }) => {
    expect(registeredHostException).toStrictEqual([{ path: HOST_PATH, reason: HOST_REASON }]);
  });

  it("an entry whose grounds are only spacing carries no grounds", ({ groundsOfSpacedReason }) => {
    expect(groundsOfSpacedReason).toStrictEqual([false]);
  });

  it("an entry written without grounds at all carries no grounds", ({ groundsOfMissingReason }) => {
    expect(groundsOfMissingReason).toStrictEqual([false]);
  });

  it("an entry that names no path registers nothing", ({ registeredPathlessException }) => {
    expect(registeredPathlessException).toStrictEqual([]);
  });

  it("an entry that is not written as a record registers nothing", ({
    registeredNonRecordEntries,
  }) => {
    expect(registeredNonRecordEntries).toStrictEqual([]);
  });

  it("options that hold no exception list register nothing", ({
    registeredFromUnlistedExceptions,
  }) => {
    expect(registeredFromUnlistedExceptions).toStrictEqual([]);
  });

  it("options written as something other than a record register nothing", ({
    registeredFromNonRecordOptions,
  }) => {
    expect(registeredFromNonRecordOptions).toStrictEqual([]);
  });

  it("options left out register nothing", ({ registeredFromAbsentOptions }) => {
    expect(registeredFromAbsentOptions).toStrictEqual([]);
  });

  it("an entry covers the files its pattern reaches", ({ exceptionsOverReachedFile }) => {
    expect(exceptionsOverReachedFile).toStrictEqual([{ path: HOST_PATH, reason: HOST_REASON }]);
  });

  it("an entry covers no file its pattern misses", ({ exceptionsOverMissedFile }) => {
    expect(exceptionsOverMissedFile).toStrictEqual([]);
  });
});
