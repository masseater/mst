import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { inspectionProgramOf } from "./inspection-program.ts";

describe("inspectionProgramOf", () => {
  describe("a value exposing the generic fields of a parsed program", () => {
    const it = test.extend("inspection", () =>
      inspectionProgramOf({
        held: { type: "Program", body: [] },
        source: "export default {};",
        config: defaultPresetAdoptionConfig,
      }));

    it("accepts the value as an inspectable program", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        program: { type: "Program", body: [] },
        problems: [],
      });
    });
  });

  describe("values that do not expose the generic fields of a parsed program", () => {
    const it = test.extend("inspections", () =>
      [null, { type: "ExpressionStatement", body: [] }, { type: "Program", body: null }].map(
        (held) =>
          inspectionProgramOf({
            held,
            source: "export default {};",
            config: defaultPresetAdoptionConfig,
          }),
      ));

    it("rejects every value with the same inspection problem", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          program: null,
          problems: [
            {
              file: "vite.config.ts",
              line: 1,
              message: "The toolchain configuration syntax tree could not be inspected.",
            },
          ],
        },
        {
          program: null,
          problems: [
            {
              file: "vite.config.ts",
              line: 1,
              message: "The toolchain configuration syntax tree could not be inspected.",
            },
          ],
        },
        {
          program: null,
          problems: [
            {
              file: "vite.config.ts",
              line: 1,
              message: "The toolchain configuration syntax tree could not be inspected.",
            },
          ],
        },
      ]);
    });
  });
});
