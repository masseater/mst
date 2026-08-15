import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { normalizedContent, regionIn, withRefreshedRegionIn } from "../generated-region.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import {
  lintRuleWorkspacesIn,
  type LintRuleWorkspace,
} from "../rule-index/lint-rule-workspaces.ts";
import { textOrNull } from "../rule-index/read-text.ts";
import { workspaceRulesOf } from "../rule-index/workspace-rules.ts";
import {
  FRONTMATTER_DESCRIPTION_PATTERN,
  GENERATED_REGIONS,
  REQUIRED_HEADINGS,
  RULE_DOCS_DIR,
  beginMarkerOf,
  endMarkerOf,
  hasNoExample,
  renderExamples,
  renderFrontmatterDescription,
  renderMessages,
  renderRuleHeader,
  renderRuntimeSelection,
} from "./render-rule-doc.ts";
import { lintRuleExamplesIn, testFilePathFor, type LintRuleExamples } from "./rule-examples.ts";
import { PLACEHOLDER_TOKENS, scaffoldRuleDoc } from "./scaffold-rule-doc.ts";

import type { LintRuleCheckReport, LintRuleProblem } from "../lint-rule-problem.ts";
import type { BundledLintRule } from "../rule-index/rule-bundle.ts";

const MISSING_DESCRIPTION = `A rule must not go without \`meta.docs.description\`; the document is built from it. Declare it on the rule.`;

const MISSING_DOC = `A rule must not go without its document. Seed it with \`${REGENERATE_COMMAND}\`, then write the sections it leaves for you.`;

const missingHeading = (heading: string): string =>
  `A rule document must not go without \`${heading}\`.`;

const remainingPlaceholder = (token: string): string =>
  `A seeded section must not be left as it was written. Replace "${token}".`;

const noExample = (testPath: string): string =>
  `A rule document must not go without an example. Mark the test cases to publish with \`documented: true\` in \`${testPath}\`.`;

const unspellableExample = ({
  caseName,
  testPath,
}: {
  readonly caseName: string;
  readonly testPath: string;
}): string =>
  `A test case marked to publish must not build its code from values this reader cannot settle. "${caseName}" in \`${testPath}\` resolves to no text. Write its code as a literal, or take the mark off it.`;

type RenderedRegion = {
  readonly region: string;
  readonly content: string;
};

const renderedRegionsOf = ({
  rule,
  examples,
}: {
  readonly rule: BundledLintRule;
  readonly examples: LintRuleExamples;
}): readonly RenderedRegion[] => [
  { region: GENERATED_REGIONS.header, content: renderRuleHeader(rule) },
  { region: GENERATED_REGIONS.examples, content: renderExamples(examples) },
  { region: GENERATED_REGIONS.messages, content: renderMessages(rule) },
  { region: GENERATED_REGIONS.runtime, content: renderRuntimeSelection(rule) },
];

const missingHeadings = (source: string): readonly string[] => {
  const written = source.split("\n").map((line) => line.trim());
  return REQUIRED_HEADINGS.filter((heading) => !written.includes(heading));
};

const FRONTMATTER_DESCRIPTION = "frontmatter description";

const foundRegionIn = ({ source, region }: { readonly source: string; readonly region: string }) =>
  regionIn({ source, begin: beginMarkerOf(region), end: endMarkerOf(region) });

const absentTargetsIn = ({
  source,
  rendered,
}: {
  readonly source: string;
  readonly rendered: readonly RenderedRegion[];
}): readonly string[] => [
  ...(FRONTMATTER_DESCRIPTION_PATTERN.test(source) ? [] : [FRONTMATTER_DESCRIPTION]),
  ...rendered
    .filter(({ region }) => foundRegionIn({ source, region }) === null)
    .map(({ region }) => region),
];

const staleTargetsIn = ({
  source,
  rule,
  rendered,
}: {
  readonly source: string;
  readonly rule: BundledLintRule;
  readonly rendered: readonly RenderedRegion[];
}): readonly string[] => [
  ...(FRONTMATTER_DESCRIPTION_PATTERN.exec(source)?.[0] === renderFrontmatterDescription(rule)
    ? []
    : [FRONTMATTER_DESCRIPTION]),
  ...rendered
    .filter(({ region, content }) => {
      const found = foundRegionIn({ source, region });
      return found !== null && normalizedContent(found.body) !== normalizedContent(content);
    })
    .map(({ region }) => region),
];

const upToDateSource = ({
  source,
  rule,
  rendered,
}: {
  readonly source: string;
  readonly rule: BundledLintRule;
  readonly rendered: readonly RenderedRegion[];
}): string =>
  rendered.reduce(
    (carried, { region, content }) =>
      withRefreshedRegionIn({
        source: carried,
        begin: beginMarkerOf(region),
        end: endMarkerOf(region),
        content,
      }),
    source.replace(FRONTMATTER_DESCRIPTION_PATTERN, renderFrontmatterDescription(rule)),
  );

const missingRegion = (region: string): string =>
  `A rule document must not lose its \`${region}\` region. Delete the file and seed it again with \`${REGENERATE_COMMAND}\`.`;

const staleRegion = (region: string): string =>
  `The \`${region}\` region must not fall behind the rule. Regenerate it with \`${REGENERATE_COMMAND}\`.`;

const generatedProblems = ({
  source,
  rule,
  rendered,
  write,
  absolutePath,
}: {
  readonly source: string;
  readonly rule: BundledLintRule;
  readonly rendered: readonly RenderedRegion[];
  readonly write: boolean;
  readonly absolutePath: string;
}): readonly string[] => {
  const absent = absentTargetsIn({ source, rendered });
  if (absent.length > 0) return absent.map(missingRegion);

  const stale = staleTargetsIn({ source, rule, rendered });
  if (stale.length === 0) return [];
  if (!write) return stale.map(staleRegion);

  writeFileSync(absolutePath, upToDateSource({ source, rule, rendered }), "utf8");
  return [];
};

const seededSourceOf = ({
  absolutePath,
  rule,
  examples,
  write,
}: {
  readonly absolutePath: string;
  readonly rule: BundledLintRule;
  readonly examples: LintRuleExamples;
  readonly write: boolean;
}): string | null => {
  const existing = textOrNull(absolutePath);
  if (existing !== null) return existing;
  if (!write) return null;

  mkdirSync(dirname(absolutePath), { recursive: true });
  const seeded = scaffoldRuleDoc({ rule, examples });
  writeFileSync(absolutePath, seeded, "utf8");
  return seeded;
};

const ruleDocProblems = ({
  repositoryRoot,
  workspace,
  rule,
  write,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
  readonly rule: BundledLintRule;
  readonly write: boolean;
}): readonly LintRuleProblem[] => {
  const file = join(workspace.workspaceDir, RULE_DOCS_DIR, `${rule.name}.md`);
  if (rule.description === "") return [{ file: rule.sourcePath, message: MISSING_DESCRIPTION }];

  const workspaceRoot = join(repositoryRoot, workspace.workspaceDir);
  const examples = lintRuleExamplesIn({ workspaceRoot, sourcePath: rule.sourcePath });
  const absolutePath = join(repositoryRoot, file);
  const source = seededSourceOf({ absolutePath, rule, examples, write });
  if (source === null) return [{ file, message: MISSING_DOC }];

  const rendered = renderedRegionsOf({ rule, examples });
  const complaints = [
    ...missingHeadings(source).map(missingHeading),
    ...generatedProblems({ source, rule, rendered, write, absolutePath }),
    ...PLACEHOLDER_TOKENS.filter((token) => source.includes(token)).map(remainingPlaceholder),
    ...(hasNoExample(examples) ? [noExample(testFilePathFor(rule.sourcePath))] : []),
    ...examples.unspellable.map((caseName) =>
      unspellableExample({ caseName, testPath: testFilePathFor(rule.sourcePath) }),
    ),
  ];
  return complaints.map((complaint) => ({ file, message: complaint }));
};

export const lintRuleDocProblems = ({
  repositoryRoot,
  write,
}: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): LintRuleCheckReport => {
  const rules = lintRuleWorkspacesIn(repositoryRoot).flatMap((workspace) =>
    workspaceRulesOf({ repositoryRoot, workspace }).map((rule) => ({ workspace, rule })),
  );
  return {
    problems: rules.flatMap(({ workspace, rule }) =>
      ruleDocProblems({ repositoryRoot, workspace, rule, write }),
    ),
    scanned: rules.length,
  };
};
