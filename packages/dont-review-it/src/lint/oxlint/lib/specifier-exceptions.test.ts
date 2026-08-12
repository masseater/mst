import { describe, expect, test } from "vite-plus/test";

import {
  carriesGrounds,
  exceptionsCovering,
  specifierExceptionsIn,
} from "./specifier-exceptions.ts";

const REPOSITORY_ROOT = "/repo";

const pathsCovering = (
  exceptions: readonly { readonly path: string; readonly reason: string }[],
  pathSegments: readonly string[],
): readonly string[] =>
  exceptionsCovering({ exceptions, pathSegments, cwd: REPOSITORY_ROOT }).map(
    (exception) => exception.path,
  );

describe("specifier-exceptions", () => {
  test("an listed names the path it covers and the grounds it carries", () => {
    expect(
      specifierExceptionsIn([
        { exceptions: [{ path: "apps/host/**", reason: "the candidates arrive as settings" }] },
      ]),
    ).toStrictEqual([{ path: "apps/host/**", reason: "the candidates arrive as settings" }]);
  });

  test("an listed whose grounds are only spacing carries no grounds", () => {
    const [listed] = specifierExceptionsIn([
      { exceptions: [{ path: "apps/host/**", reason: "  " }] },
    ]);
    expect(listed === undefined ? null : carriesGrounds(listed)).toBe(false);
  });

  test("an listed written without grounds at all carries no grounds", () => {
    const [listed] = specifierExceptionsIn([{ exceptions: [{ path: "apps/host/**" }] }]);
    expect(listed === undefined ? null : carriesGrounds(listed)).toBe(false);
  });

  test("an listed that names no path registers nothing", () => {
    expect(
      specifierExceptionsIn([{ exceptions: [{ reason: "the candidates arrive as settings" }] }]),
    ).toStrictEqual([]);
  });

  test("an listed that is not written as a record registers nothing", () => {
    expect(specifierExceptionsIn([{ exceptions: ["apps/host/**", null, []] }])).toStrictEqual([]);
  });

  test("options that hold no exception list register nothing", () => {
    expect(specifierExceptionsIn([{ exceptions: "apps/host/**" }])).toStrictEqual([]);
  });

  test("options written as something other than a record register nothing", () => {
    expect(specifierExceptionsIn([["apps/host/**"]])).toStrictEqual([]);
  });

  test("options left out register nothing", () => {
    expect(specifierExceptionsIn([])).toStrictEqual([]);
  });

  test("an listed covers the files its pattern reaches", () => {
    expect(
      pathsCovering(
        [{ path: "apps/host/**", reason: "the candidates arrive as settings" }],
        ["repo", "apps", "host", "loader.ts"],
      ),
    ).toStrictEqual(["apps/host/**"]);
  });

  test("an listed covers no file its pattern misses", () => {
    expect(
      pathsCovering(
        [{ path: "apps/host/**", reason: "the candidates arrive as settings" }],
        ["repo", "apps", "site", "loader.ts"],
      ),
    ).toStrictEqual([]);
  });
});
