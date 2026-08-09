import packageManifest from "../package.json" with { type: "json" };

const REPOSITORY_BLOB_BASE_URL = `${packageManifest.repository.url
  .replace(/^git\+/u, "")
  .replace(/\.git$/u, "")}/blob/main`;

export type WorkspaceLintRuleIdentity = {
  readonly workspaceDir: string;
  readonly ruleName: string;
};

export const workspaceLintRuleDocsRelativePath = ({
  workspaceDir,
  ruleName,
}: WorkspaceLintRuleIdentity): string => `${workspaceDir}/docs/lint/${ruleName}.md`;

export const workspaceLintRuleDocsUrl = (identity: WorkspaceLintRuleIdentity): string =>
  `${REPOSITORY_BLOB_BASE_URL}/${workspaceLintRuleDocsRelativePath(identity)}`;
