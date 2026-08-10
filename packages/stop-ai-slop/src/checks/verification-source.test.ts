import { describe, expect, it } from "vite-plus/test";

import { absenceVerificationsIn, valueExportsIn } from "./verification-source.ts";

const imports = 'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n';

describe("absenceVerificationsIn", () => {
  it("rejects file assertions that do not use the exact imported call and repository path shape", () => {
    const windowsPath = JSON.stringify("C:\\src\\legacy.ts");
    const source = `${imports}
      const value = false;
      const path = "src/legacy.ts";
      expect(value).toBe(false);
      globalThis.expect(existsSync("src/legacy.ts")).toBe(false);
      expect(existsSync()).toBe(false);
      expect(existsSync("src/legacy.ts", "src/other.ts")).toBe(false);
      expect(existsSync(path)).toBe(false);
      expect(existsSync("/src/legacy.ts")).toBe(false);
      expect(existsSync(${windowsPath})).toBe(false);
      expect(existsSync(".")).toBe(false);
      expect(existsSync("..")).toBe(false);
      expect(existsSync("../src/legacy.ts")).toBe(false);
      expect(existsSync("src/legacy.ts")).toBe();
      expect(existsSync("src/legacy.ts")).toBe(false, true);
    `;

    expect(absenceVerificationsIn({ file: "src/probe.test.ts", source })).toStrictEqual([]);
  });

  it("accepts a parent-relative namespace import but rejects unresolved module locators", () => {
    const source = `
      import * as legacy from "../legacy.ts";
      import * as outside from "../../../outside.ts";
      import * as packageApi from "package-api";
      import * as extensionless from "./extensionless";
      import * as jsonApi from "./api.json";
      import { expect } from "vite-plus/test";

      expect(legacy).not.toHaveProperty("legacyMode");
      expect(outside).not.toHaveProperty("legacyMode");
      expect(packageApi).not.toHaveProperty("legacyMode");
      expect(extensionless).not.toHaveProperty("legacyMode");
      expect(jsonApi).not.toHaveProperty("legacyMode");
      expect(unimported).not.toHaveProperty("legacyMode");
    `;

    expect(absenceVerificationsIn({ file: "src/nested/probe.test.ts", source })).toStrictEqual([
      {
        kind: "export",
        locator: '["declaration","src/legacy.ts","legacyMode"]',
        modulePath: "src/legacy.ts",
        exportName: "legacyMode",
        file: "src/nested/probe.test.ts",
        line: 9,
        endLine: 9,
      },
    ]);
  });

  it("rejects positive, malformed, and non-identifier export assertions", () => {
    const source = `
      import * as legacy from "./legacy.ts";
      import { expect } from "vite-plus/test";

      expect(legacy).toHaveProperty("legacyMode");
      expect().toBeUndefined();
      expect(getLegacy().legacyMode).toBeUndefined();
      expect(legacy.legacyMode).toBeUndefined(false);
      expect(legacy["legacyMode"]).toBeUndefined();
    `;

    expect(absenceVerificationsIn({ file: "src/probe.test.ts", source })).toStrictEqual([]);
  });

  it("accepts an exact undefined-property assertion", () => {
    const source = `
      import * as legacy from "./legacy.ts";
      import { expect } from "vite-plus/test";

      expect(legacy.legacyMode).toBeUndefined();
    `;

    expect(absenceVerificationsIn({ file: "src/probe.test.ts", source })).toStrictEqual([
      {
        kind: "export",
        locator: '["declaration","src/legacy.ts","legacyMode"]',
        modulePath: "src/legacy.ts",
        exportName: "legacyMode",
        file: "src/probe.test.ts",
        line: 5,
        endLine: 5,
      },
    ]);
  });

  it("throws a file-qualified error for invalid source", () => {
    expect(() =>
      absenceVerificationsIn({ file: "src/broken.test.ts", source: "export {" }),
    ).toThrow(/^src\/broken\.test\.ts:/u);
  });
});

describe("valueExportsIn", () => {
  it("returns only named runtime exports", () => {
    expect(
      valueExportsIn({
        file: "src/module.ts",
        source: `
          const local = true;
          export { local as named, local as default };
          export type { External } from "./types.ts";
          export * as namespace from "./other.ts";
        `,
      }),
    ).toStrictEqual(["named", "namespace"]);
  });
});
