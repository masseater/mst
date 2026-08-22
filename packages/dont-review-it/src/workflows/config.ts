export type WorkflowChecksConfig = {
  readonly workflowDirectory: string;
  readonly workflowFileExtensions: readonly string[];
  readonly triggersKey: string;
  readonly jobsKey: string;
  readonly stepsKey: string;
  readonly runKey: string;
  readonly usesKey: string;
  readonly withKey: string;
  readonly fetchDepthKey: string;
  readonly checkoutActionSpecifier: string;
  readonly permissionsKey: string;
  readonly continueOnErrorKey: string;
  readonly gatingTriggers: readonly string[];
  readonly narrowingKeys: readonly string[];
  readonly reusableTrigger: string;
  readonly crossWorkflowTrigger: string;
  readonly statementSeparators: readonly string[];
  readonly controlFlowKeywords: readonly string[];
  readonly failureMaskingSnippets: readonly string[];
  readonly renovateConfigPaths: readonly string[];
  readonly dependabotConfigPaths: readonly string[];
  readonly updatesKey: string;
  readonly packageEcosystemKey: string;
  readonly actionsEcosystem: string;
};

export const defaultWorkflowChecksConfig: WorkflowChecksConfig = {
  workflowDirectory: ".github/workflows",
  workflowFileExtensions: [".yml", ".yaml"],
  triggersKey: "on",
  jobsKey: "jobs",
  stepsKey: "steps",
  runKey: "run",
  usesKey: "uses",
  withKey: "with",
  fetchDepthKey: "fetch-depth",
  checkoutActionSpecifier: "actions/checkout",
  permissionsKey: "permissions",
  continueOnErrorKey: "continue-on-error",
  gatingTriggers: ["pull_request", "pull_request_target"],
  narrowingKeys: ["branches", "branches-ignore", "paths", "paths-ignore"],
  reusableTrigger: "workflow_call",
  crossWorkflowTrigger: "workflow_run",
  statementSeparators: ["&&", "||", ";", "|"],
  controlFlowKeywords: ["if", "for", "while", "until", "case", "select"],
  failureMaskingSnippets: ["|| true", "|| :", "|| exit 0"],
  renovateConfigPaths: [
    "renovate.json",
    "renovate.json5",
    ".renovaterc",
    ".renovaterc.json",
    ".renovaterc.json5",
    ".github/renovate.json",
    ".github/renovate.json5",
  ],
  dependabotConfigPaths: [".github/dependabot.yml", ".github/dependabot.yaml"],
  updatesKey: "updates",
  packageEcosystemKey: "package-ecosystem",
  actionsEcosystem: "github-actions",
};
