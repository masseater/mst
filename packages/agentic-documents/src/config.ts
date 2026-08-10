export type GeneratedRegionBoundary = {
  readonly begin: string;
  readonly end: string;
};

export type WorkspaceListConfig = {
  readonly path: string;
  readonly region: GeneratedRegionBoundary;
  readonly definitionFile: string;
  readonly definitionField: string;
};

export type AgenticDocumentsConfig = {
  readonly normativeDocumentFileName: string;
  readonly companionFileNames: readonly string[];
  readonly requiredFrontmatterFields: readonly string[];
  readonly decisionKeywords: readonly string[];
  readonly prohibitionKeyword: string;
  readonly negatedKeywords: readonly string[];
  readonly sentenceTerminators: readonly string[];
  readonly orderedLabelWords: readonly string[];
  readonly contrastiveNegativeMarkers: readonly string[];
  readonly contrastivePositiveMarkers: readonly string[];
  readonly sectionBoundaryHeadingDepth: number;
  readonly generatedRegionBoundaries: readonly GeneratedRegionBoundary[];
  readonly ignoredDirectories: readonly string[];
  readonly repositoryRelativePrefixes: readonly string[];
  readonly pointerMark: string;
  readonly duplicateUnitMinimumLength: number;
  readonly pointerUnitPrefixes: readonly string[];
  readonly versionExclusionPatterns: readonly string[];
  readonly workspaceList: WorkspaceListConfig | null;
};

const TOOLCHAIN_REGION: GeneratedRegionBoundary = {
  begin: "<!--VITE PLUS START-->",
  end: "<!--VITE PLUS END-->",
};

const WORKSPACE_LIST_REGION: GeneratedRegionBoundary = {
  begin: "<!-- BEGIN GENERATED workspaces -->",
  end: "<!-- END GENERATED workspaces -->",
};

export const defaultConfig: AgenticDocumentsConfig = {
  normativeDocumentFileName: "AGENTS.md",
  companionFileNames: ["CLAUDE.md"],
  requiredFrontmatterFields: ["description"],
  decisionKeywords: ["MUST", "PROHIBIT", "SHOULD NOT", "SHOULD", "MAY"],
  prohibitionKeyword: "PROHIBIT",
  negatedKeywords: ["MUST NOT"],
  sentenceTerminators: ["。"],
  orderedLabelWords: ["Phase", "Step", "Stage", "フェーズ", "ステップ", "段階"],
  contrastiveNegativeMarkers: ["NG", "Bad", "Before", "悪い例", "誤った例", "非推奨"],
  contrastivePositiveMarkers: ["OK", "Good", "After", "良い例", "正しい例", "推奨"],
  sectionBoundaryHeadingDepth: 2,
  generatedRegionBoundaries: [TOOLCHAIN_REGION],
  ignoredDirectories: ["node_modules", ".git", "dist", "coverage", ".claude", ".local-agents"],
  repositoryRelativePrefixes: ["apps/", "packages/", "docs/", "tools/"],
  pointerMark: "@",
  duplicateUnitMinimumLength: 40,
  pointerUnitPrefixes: ["詳細は", "参照:", "See ", "Refer to "],
  versionExclusionPatterns: [],
  workspaceList: {
    path: "docs/workspaces.md",
    region: WORKSPACE_LIST_REGION,
    definitionFile: "pnpm-workspace.yaml",
    definitionField: "packages",
  },
};
