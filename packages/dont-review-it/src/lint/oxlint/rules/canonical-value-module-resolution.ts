import type { Context, Variable } from "@oxlint/plugins";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValueModuleResolution = {
  readonly context: Context;
  readonly cutoff: number;
  readonly propertyState: CanonicalValuePropertyState;
  readonly seen: ReadonlySet<Variable>;
};
