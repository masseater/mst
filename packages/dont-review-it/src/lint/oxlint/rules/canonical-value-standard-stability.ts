import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueBindingIndex,
  CanonicalValueExecutionContext,
  CanonicalValueGlobalWrite,
} from "./canonical-value-binding-index.ts";
import type { CanonicalValueGuardExecution } from "./canonical-value-property-static.ts";

type StandardStabilityRuntime = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly execution: (node: ESTree.Node) => CanonicalValueGuardExecution;
};

const runtimePathAffects = (
  expectedPath: readonly string[],
  writePath: readonly (string | null)[],
): boolean =>
  writePath.length <= expectedPath.length &&
  writePath.every((segment, index) => segment === null || segment === expectedPath[index]);

const executionMayOccur = (execution: CanonicalValueGuardExecution): boolean =>
  !execution.definite || execution.executes;

const writeMayExecute = (
  runtime: StandardStabilityRuntime,
  input: {
    readonly cutoff: number;
    readonly executionContext: CanonicalValueExecutionContext;
    readonly write: CanonicalValueGlobalWrite;
  },
): boolean => {
  if (!executionMayOccur(runtime.execution(input.write.expression))) return false;
  return runtime.bindingIndex
    .writeOccurrencesOf(input.write, input)
    .some((occurrence) =>
      occurrence.callSites.every((callSite) => executionMayOccur(runtime.execution(callSite))),
    );
};

export const canonicalValueStandardPathIsStable = (
  runtime: StandardStabilityRuntime,
  input: {
    readonly cutoff: number;
    readonly executionContext: CanonicalValueExecutionContext;
    readonly path: readonly string[];
  },
): boolean =>
  !runtime.bindingIndex
    .globalWrites()
    .some(
      (write) =>
        runtimePathAffects(input.path, write.runtimePath) &&
        writeMayExecute(runtime, { ...input, write }),
    );
