import { blockOf } from "../generated-region.ts";
import {
  GENERATED_REGIONS,
  beginMarkerOf,
  endMarkerOf,
  renderExamples,
  renderFrontmatterDescription,
  renderMessages,
  renderRuleHeader,
  renderRuntimeSelection,
} from "./render-rule-doc.ts";

import type { LintRuleFacts } from "../rule-index/rule-facts.ts";
import type { LintRuleExamples } from "./rule-examples.ts";

const VIOLATION_PLACEHOLDER =
  "State what this rule rejects, why the invariant behind it holds, and where the detection stops short.";

const FIX_PLACEHOLDER = "State the change that resolves a report.";

const BYPASS_PLACEHOLDER = "Name the ways a report can be silenced without being resolved.";

export const PLACEHOLDER_TOKENS: readonly string[] = [
  VIOLATION_PLACEHOLDER,
  FIX_PLACEHOLDER,
  BYPASS_PLACEHOLDER,
];

const generatedBlockOf = ({
  region,
  content,
}: {
  readonly region: string;
  readonly content: string;
}): string => blockOf({ begin: beginMarkerOf(region), content, end: endMarkerOf(region) });

export const scaffoldRuleDoc = ({
  rule,
  examples,
}: {
  readonly rule: LintRuleFacts;
  readonly examples: LintRuleExamples;
}): string =>
  [
    "---",
    renderFrontmatterDescription(rule),
    "---",
    "",
    `# ${rule.name}`,
    "",
    generatedBlockOf({ region: GENERATED_REGIONS.header, content: renderRuleHeader(rule) }),
    "",
    "## Violation",
    "",
    VIOLATION_PLACEHOLDER,
    "",
    "## Fix",
    "",
    FIX_PLACEHOLDER,
    "",
    generatedBlockOf({ region: GENERATED_REGIONS.examples, content: renderExamples(examples) }),
    "",
    "### Forbidden bypasses (do not do this)",
    "",
    BYPASS_PLACEHOLDER,
    "",
    "## Messages",
    "",
    generatedBlockOf({ region: GENERATED_REGIONS.messages, content: renderMessages(rule) }),
    "",
    "## Runtime Selection",
    "",
    generatedBlockOf({
      region: GENERATED_REGIONS.runtime,
      content: renderRuntimeSelection(rule),
    }),
    "",
  ].join("\n");
