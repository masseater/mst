import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { inspectionProgramOf } from "./inspection-program.ts";

const inspect = (held: unknown) =>
  inspectionProgramOf({ held, source: "export default {};", config: defaultPresetAdoptionConfig });

describe("inspectionProgramOf", () => {
  test("accepts the generic fields of a parsed program", () => {
    expect(inspect({ type: "Program", body: [] }).problems).toStrictEqual([]);
  });

  test.each([null, { type: "ExpressionStatement", body: [] }, { type: "Program", body: null }])(
    "rejects a value that does not expose program fields",
    (held) => {
      const inspection = inspect(held);

      expect(inspection.program).toBeNull();
      expect(inspection.problems[0]?.message).toContain("syntax tree could not be inspected");
    },
  );
});
