import type { LintRuleFacts } from "./rule-facts.ts";

export const noticesOf = (rule: LintRuleFacts): string =>
  [rule.fixable ? "🔧" : "", rule.hasSuggestions ? "💡" : "", rule.configurable ? "⚙️" : ""]
    .filter((symbol) => symbol !== "")
    .join(" ");

export const escapePipes = (writtenText: string): string => writtenText.replaceAll("|", "\\|");
