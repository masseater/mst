import type { ChangedFile } from "./name-status.ts";
import type { CiCheck, PrContext, ReviewThread } from "./pr-context.ts";

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", "<br>");

const contentLabel = (file: ChangedFile): string => {
  if (file.content !== null) return "included";
  return file.omissionReason === null
    ? "omitted: not available"
    : `omitted: ${file.omissionReason}`;
};

const changedFilesSection = (files: readonly ChangedFile[]): readonly string[] => [
  "## Changed Files",
  "",
  "| Status | Path | Content |",
  "| --- | --- | --- |",
  ...files.map(
    (file) => `| ${cell(file.statusCode)} | ${cell(file.path)} | ${cell(contentLabel(file))} |`,
  ),
  "",
];

const unresolvedCount = (threads: readonly ReviewThread[]): number =>
  threads.filter((thread) => !thread.resolved).length;

const outdatedCount = (threads: readonly ReviewThread[]): number =>
  threads.filter((thread) => thread.outdated).length;

const outdatedUnresolvedCount = (threads: readonly ReviewThread[]): number =>
  threads.filter((thread) => thread.outdated && !thread.resolved).length;

const commentsSection = (context: PrContext): readonly string[] => [
  "## Existing Comments",
  "",
  `- Reviews: ${context.comments.reviews.length}`,
  `- PR-level comments: ${context.comments.prComments.length}`,
  `- Inline comments: ${context.comments.inlineComments.length}`,
  `- Threads: ${context.comments.threads.length}`,
  `- Unresolved threads: ${unresolvedCount(context.comments.threads)}`,
  `- Outdated threads: ${outdatedCount(context.comments.threads)}`,
  `- Outdated and unresolved threads: ${outdatedUnresolvedCount(context.comments.threads)}`,
  "",
];

const ciRow = (check: CiCheck): string =>
  `| ${cell(check.name)} | ${cell(check.state)} | ${cell(check.bucket)} | ${check.detailsUrl === null ? "" : cell(check.detailsUrl)} |`;

const ciSection = (context: PrContext): readonly string[] => [
  "## CI",
  "",
  "| Name | State | Bucket | Details |",
  "| --- | --- | --- | --- |",
  ...context.ci.checks.map(ciRow),
  "",
];

const failedLogsSection = (context: PrContext): readonly string[] =>
  context.ci.failedLogPaths.length === 0
    ? ["No failed CI logs were downloaded."]
    : ["Failed CI logs:", "", ...context.ci.failedLogPaths.map((path) => `- ${path}`)];

export const renderMarkdown = (context: PrContext): string =>
  [
    "# PR Context",
    "",
    "## Pull Request",
    "",
    `- PR: #${context.prNumber}`,
    `- Base: ${context.base}`,
    `- Head: ${context.head}`,
    "",
    ...changedFilesSection(context.changedFiles),
    ...commentsSection(context),
    ...ciSection(context),
    ...failedLogsSection(context),
  ].join("\n");
