import { describe, expect, test } from "vite-plus/test";

import { absenceVerificationsIn, valueExportsIn } from "./verification-source.ts";

describe("absenceVerificationsIn", () => {
  describe("file assertions missing the exact imported call and repository path shape", () => {
    const it = test.extend("fileShapeVerifications", () => {
      const windowsPath = JSON.stringify(String.raw`C:\src\legacy.ts`);
      const source = `import { existsSync } from "node:fs";
import { expect } from "vite-plus/test";

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
      return absenceVerificationsIn({ file: "src/probe.test.ts", source });
    });

    it("rejects every one of them", ({ fileShapeVerifications }) => {
      expect(fileShapeVerifications).toStrictEqual([]);
    });
  });

  describe("namespace imports resolving to a parent-relative module and to nothing else", () => {
    const it = test.extend("namespaceImportVerifications", () => {
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
      return absenceVerificationsIn({ file: "src/nested/probe.test.ts", source });
    });

    it("keeps the parent-relative one alone", ({ namespaceImportVerifications }) => {
      expect(namespaceImportVerifications).toStrictEqual([
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
  });

  describe("positive, malformed, and non-identifier export assertions", () => {
    const it = test.extend("exportAssertionVerifications", () => {
      const source = `
      import * as legacy from "./legacy.ts";
      import { expect } from "vite-plus/test";

      expect(legacy).toHaveProperty("legacyMode");
      expect().toBeUndefined();
      expect(getLegacy().legacyMode).toBeUndefined();
      expect(legacy.legacyMode).toBeUndefined(false);
      expect(legacy["legacyMode"]).toBeUndefined();
    `;
      return absenceVerificationsIn({ file: "src/probe.test.ts", source });
    });

    it("rejects every one of them", ({ exportAssertionVerifications }) => {
      expect(exportAssertionVerifications).toStrictEqual([]);
    });
  });

  describe("an exact undefined-property assertion", () => {
    const it = test.extend("undefinedPropertyVerifications", () => {
      const source = `
      import * as legacy from "./legacy.ts";
      import { expect } from "vite-plus/test";

      expect(legacy.legacyMode).toBeUndefined();
    `;
      return absenceVerificationsIn({ file: "src/probe.test.ts", source });
    });

    it("accepts it", ({ undefinedPropertyVerifications }) => {
      expect(undefinedPropertyVerifications).toStrictEqual([
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
  });

  describe("a source the parser cannot read", () => {
    const it = test.extend("unparsableSourceFailure", () => {
      try {
        absenceVerificationsIn({ file: "src/broken.test.ts", source: "export {" });
      } catch (parseFailure) {
        return parseFailure;
      }
      throw new Error("absenceVerificationsIn accepted a source the parser cannot read");
    });

    it("throws an error qualified by the file it came from", ({ unparsableSourceFailure }) => {
      expect(unparsableSourceFailure).toStrictEqual(
        new Error("src/broken.test.ts: Expected `}` but found `EOF`"),
      );
    });
  });
});

describe("valueExportsIn", () => {
  describe("a module exporting a named binding, a default, a type, and a namespace", () => {
    const it = test.extend("runtimeExportNames", () =>
      valueExportsIn({
        file: "src/module.ts",
        source: `
          const local = true;
          export { local as named, local as default };
          export type { External } from "./types.ts";
          export * as namespace from "./other.ts";
        `,
      }));

    it("returns only the named runtime ones", ({ runtimeExportNames }) => {
      expect(runtimeExportNames).toStrictEqual(["named", "namespace"]);
    });
  });
});
