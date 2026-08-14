import { posix } from "node:path";

import { lintToolOf } from "../lint-tool.ts";

import type { LintRuleFacts } from "../rule-index/rule-facts.ts";
import type { LintRuleExample, LintRuleExamples } from "./rule-examples.ts";

export const RULE_DOCS_DIR = posix.join("docs", "lint");

export const REQUIRED_HEADINGS: readonly string[] = [
  "## Violation",
  "## Fix",
  "## Messages",
  "## Runtime Selection",
];

export const GENERATED_REGIONS = {
  header: "rule-header",
  examples: "examples",
  messages: "messages",
  runtime: "runtime",
} as const;

export const beginMarkerOf = (region: string): string => `<!-- BEGIN GENERATED ${region} -->`;

export const endMarkerOf = (region: string): string => `<!-- END GENERATED ${region} -->`;

export const FRONTMATTER_DESCRIPTION_PATTERN = /^description:.*$/mu;

const escapedDescription = (description: string): string =>
  description.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export const renderFrontmatterDescription = (rule: LintRuleFacts): string =>
  `description: "${escapedDescription(rule.description)}"`;

const yesOrNo = (holds: boolean): string => (holds ? "yes" : "no");

const sourceLinkOf = (sourcePath: string): string => {
  const shown = posix.basename(sourcePath);
  const reached = posix.relative(RULE_DOCS_DIR, sourcePath);
  return `[\`${shown}\`](${reached})`;
};

export const renderRuleHeader = (rule: LintRuleFacts): string =>
  [
    rule.description,
    "",
    `- Tool: \`${lintToolOf(rule.sourcePath)}\``,
    `- Fixable: ${yesOrNo(rule.fixable)}`,
    `- Suggestions: ${yesOrNo(rule.hasSuggestions)}`,
    `- Options: ${yesOrNo(rule.configurable)}`,
    `- Shipped in the preset: ${yesOrNo(rule.shipped)}`,
    `- Source: ${sourceLinkOf(rule.sourcePath)}`,
  ].join("\n");

const CELL_REPLACEMENTS: readonly { readonly target: string; readonly replacement: string }[] = [
  { target: "\\", replacement: "\\\\" },
  { target: "`", replacement: "\\`" },
  { target: "*", replacement: "\\*" },
  { target: "|", replacement: "\\|" },
  { target: "\n", replacement: " " },
];

const escapedCell = (written: string): string =>
  CELL_REPLACEMENTS.reduce(
    (escaped, { target, replacement }) => escaped.replaceAll(target, replacement),
    written,
  );

const MESSAGES_TABLE_HEAD = "| messageId | Text |\n| --- | --- |";

const NO_MESSAGES =
  "This rule declares no message of its own. A report carries the rule name alone.";

export const renderMessages = (rule: LintRuleFacts): string =>
  rule.messages.length === 0
    ? NO_MESSAGES
    : [
        MESSAGES_TABLE_HEAD,
        ...rule.messages.map(
          (complaint) => `| \`${complaint.messageId}\` | ${escapedCell(complaint.template)} |`,
        ),
      ].join("\n");

const OXLINT = "oxlint";

const hostSentenceOf = (rule: LintRuleFacts): string =>
  lintToolOf(rule.sourcePath) === OXLINT
    ? "This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships."
    : "This rule runs as an ESLint plugin rule.";

const optionSentenceOf = (rule: LintRuleFacts): string =>
  rule.configurable
    ? "It reads options declared on `meta.schema` in the source linked above."
    : "It reads no options. A consumer turns it on or off as a whole.";

export const renderRuntimeSelection = (rule: LintRuleFacts): string =>
  `${hostSentenceOf(rule)} ${optionSentenceOf(rule)}`;

const REJECTED_HEADING = "Code this rule rejects.";

const ACCEPTED_HEADING = "Code this rule accepts.";

const blockOf = ({ name, code, filename }: LintRuleExample): string =>
  ["```ts", `// ${name}`, ...(filename === null ? [] : [`// in ${filename}`]), code, "```"].join(
    "\n",
  );

const groupOf = ({
  heading,
  examples,
}: {
  readonly heading: string;
  readonly examples: readonly LintRuleExample[];
}): readonly string[] =>
  examples.length === 0 ? [] : [heading, "", examples.map(blockOf).join("\n\n")];

export const renderExamples = (examples: LintRuleExamples): string =>
  [
    ...groupOf({ heading: REJECTED_HEADING, examples: examples.invalid }),
    ...(examples.invalid.length > 0 && examples.valid.length > 0 ? [""] : []),
    ...groupOf({ heading: ACCEPTED_HEADING, examples: examples.valid }),
  ].join("\n");

export const hasNoExample = (examples: LintRuleExamples): boolean =>
  examples.valid.length === 0 && examples.invalid.length === 0;
