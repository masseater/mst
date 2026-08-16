import { parseSync } from "oxc-parser";

import { NODE_TYPE_FIELD } from "../../lint/oxlint/lib/ast-node.ts";
import {
  defaultExportedValue,
  fieldsIn,
  LITERAL,
  nodeOfType,
  unwrappedCall,
  valueAt,
} from "../../lint/oxlint/lib/config-object.ts";
import { ARRAY_EXPRESSION } from "../../lint/oxlint/lib/node-kinds.ts";
import { LINT_BUNDLE_NAMES, type LintBundle } from "./bundle-names.ts";

const LINT_FIELD = "lint";

const BUNDLES_FIELD = "bundles";

const EVERY_BUNDLE = "all";

const namedBundlesIn = (held: unknown): readonly LintBundle[] =>
  fieldsIn(nodeOfType({ held, type: ARRAY_EXPRESSION })?.elements)
    .filter((listed) => String(listed[NODE_TYPE_FIELD]) === LITERAL)
    .map((listed) => String(listed.value))
    .filter((spelled): spelled is LintBundle =>
      LINT_BUNDLE_NAMES.some((bundle) => bundle === spelled),
    );

export const adoptedBundlesIn = ({
  source,
  toolchainConfigFileName,
}: {
  readonly source: string;
  readonly toolchainConfigFileName: string;
}): readonly LintBundle[] | null => {
  const configured = defaultExportedValue(parseSync(toolchainConfigFileName, source).program);
  const lint = unwrappedCall(valueAt({ held: configured, key: LINT_FIELD }));
  const declared = valueAt({ held: lint, key: BUNDLES_FIELD });
  if (declared === null || declared === undefined) return null;

  const literal = nodeOfType({ held: declared, type: LITERAL });
  if (literal !== null) {
    return String(literal.value) === EVERY_BUNDLE ? LINT_BUNDLE_NAMES : [];
  }
  return namedBundlesIn(declared);
};
