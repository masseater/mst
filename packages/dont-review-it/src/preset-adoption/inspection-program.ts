import { isAstFields } from "../lint/oxlint/lib/ast-node.ts";
import { problemAt } from "./inspection-problem.ts";

import type { ESTree } from "@oxlint/plugins";
import type { PresetAdoptionConfig } from "./config.ts";
import type { PresetAdoptionInspection } from "./inspection-types.ts";

const isInspectionProgram = (held: unknown): held is ESTree.Program =>
  isAstFields(held) && held.type === "Program" && Array.isArray(held.body);

export const inspectionProgramOf = ({
  held,
  source,
  config,
}: {
  readonly held: unknown;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): {
  readonly program: ESTree.Program | null;
  readonly problems: PresetAdoptionInspection["problems"];
} =>
  isInspectionProgram(held)
    ? { program: held, problems: [] }
    : {
        program: null,
        problems: [
          problemAt({
            source,
            start: 0,
            config,
            message: "The toolchain configuration syntax tree could not be inspected.",
          }),
        ],
      };
