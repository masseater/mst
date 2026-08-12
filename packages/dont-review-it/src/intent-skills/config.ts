export type IntentSkillsConfig = {
  readonly skillsDirectory: string;
  readonly skillFileName: string;
  readonly requiredFilesEntry: string;
  readonly requiredKeyword: string;
};

export const defaultIntentSkillsConfig: IntentSkillsConfig = {
  skillsDirectory: "skills",
  skillFileName: "SKILL.md",
  requiredFilesEntry: "skills",
  requiredKeyword: "tanstack-intent",
};
