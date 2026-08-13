export type WorkflowChecksConfig = {
  readonly workflowDirectory: string;
  readonly workflowFileExtensions: readonly string[];
  readonly triggersKey: string;
  readonly jobsKey: string;
  readonly stepsKey: string;
  readonly runKey: string;
  readonly permissionsKey: string;
  readonly continueOnErrorKey: string;
  readonly gatingTriggers: readonly string[];
  readonly narrowingKeys: readonly string[];
  readonly reusableTrigger: string;
  readonly crossWorkflowTrigger: string;
  readonly statementSeparators: readonly string[];
  readonly controlFlowKeywords: readonly string[];
  readonly failureMaskingSnippets: readonly string[];
};

export const defaultWorkflowChecksConfig: WorkflowChecksConfig = {
  workflowDirectory: ".github/workflows",
  workflowFileExtensions: [".yml", ".yaml"],
  triggersKey: "on",
  jobsKey: "jobs",
  stepsKey: "steps",
  runKey: "run",
  permissionsKey: "permissions",
  continueOnErrorKey: "continue-on-error",
  gatingTriggers: ["pull_request", "pull_request_target"],
  narrowingKeys: ["branches", "branches-ignore", "paths", "paths-ignore"],
  reusableTrigger: "workflow_call",
  crossWorkflowTrigger: "workflow_run",
  statementSeparators: ["&&", "||", ";", "|"],
  controlFlowKeywords: ["if", "for", "while", "until", "case", "select"],
  failureMaskingSnippets: ["|| true", "|| :", "|| exit 0"],
};
