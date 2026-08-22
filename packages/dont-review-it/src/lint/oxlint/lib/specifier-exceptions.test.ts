import { describe, expect, test } from "vite-plus/test";

import {
  carriesGrounds,
  exceptionsCovering,
  specifierExceptionsIn,
} from "./specifier-exceptions.ts";

const REPOSITORY_ROOT = "/repo";

const HOST_PATH = "apps/host/**";

const HOST_REASON = "the candidates arrive as settings";

describe("specifierExceptionsIn", () => {
  describe("an entry written with a path and grounds", () => {
    const it = test.extend("exceptions", () =>
      specifierExceptionsIn([{ exceptions: [{ path: HOST_PATH, reason: HOST_REASON }] }]));

    it("registers the path it covers and the grounds it carries", ({ exceptions }) => {
      expect(exceptions).toStrictEqual([{ path: HOST_PATH, reason: HOST_REASON }]);
    });
  });

  describe("an entry that names no path", () => {
    const it = test.extend("exceptions", () =>
      specifierExceptionsIn([{ exceptions: [{ reason: HOST_REASON }] }]));

    it("registers nothing", ({ exceptions }) => {
      expect(exceptions).toStrictEqual([]);
    });
  });

  describe("entries that are not written as records", () => {
    const it = test.extend("exceptions", () =>
      specifierExceptionsIn([{ exceptions: [HOST_PATH, null, []] }]));

    it("registers nothing", ({ exceptions }) => {
      expect(exceptions).toStrictEqual([]);
    });
  });

  describe("options that hold no exception list", () => {
    const it = test.extend("exceptions", () => specifierExceptionsIn([{ exceptions: HOST_PATH }]));

    it("registers nothing", ({ exceptions }) => {
      expect(exceptions).toStrictEqual([]);
    });
  });

  describe("options written as something other than a record", () => {
    const it = test.extend("exceptions", () => specifierExceptionsIn([[HOST_PATH]]));

    it("registers nothing", ({ exceptions }) => {
      expect(exceptions).toStrictEqual([]);
    });
  });

  describe("options left out altogether", () => {
    const it = test.extend("exceptions", () => specifierExceptionsIn([]));

    it("registers nothing", ({ exceptions }) => {
      expect(exceptions).toStrictEqual([]);
    });
  });
});

describe("carriesGrounds", () => {
  describe("an entry whose grounds are only spacing", () => {
    const it = test.extend("grounds", () =>
      specifierExceptionsIn([{ exceptions: [{ path: HOST_PATH, reason: "  " }] }]).map(
        (exception) => carriesGrounds(exception),
      ));

    it("carries no grounds", ({ grounds }) => {
      expect(grounds).toStrictEqual([false]);
    });
  });

  describe("an entry written without grounds at all", () => {
    const it = test.extend("grounds", () =>
      specifierExceptionsIn([{ exceptions: [{ path: HOST_PATH }] }]).map((exception) =>
        carriesGrounds(exception),
      ));

    it("carries no grounds", ({ grounds }) => {
      expect(grounds).toStrictEqual([false]);
    });
  });
});

describe("exceptionsCovering", () => {
  describe("a file the pattern of an entry reaches", () => {
    const it = test.extend("coveringExceptions", () =>
      exceptionsCovering({
        exceptions: [{ path: HOST_PATH, reason: HOST_REASON }],
        pathSegments: ["repo", "apps", "host", "loader.ts"],
        cwd: REPOSITORY_ROOT,
      }));

    it("is covered by that entry", ({ coveringExceptions }) => {
      expect(coveringExceptions).toStrictEqual([{ path: HOST_PATH, reason: HOST_REASON }]);
    });
  });

  describe("a file the pattern of an entry misses", () => {
    const it = test.extend("coveringExceptions", () =>
      exceptionsCovering({
        exceptions: [{ path: HOST_PATH, reason: HOST_REASON }],
        pathSegments: ["repo", "apps", "site", "loader.ts"],
        cwd: REPOSITORY_ROOT,
      }));

    it("is covered by nothing", ({ coveringExceptions }) => {
      expect(coveringExceptions).toStrictEqual([]);
    });
  });
});
