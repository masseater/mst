import { defineConfig, type EmbeddedLanguageFormattingConfig, type OxfmtConfig } from "oxfmt";

/** @canonical-values dont-review-it.embedded-language-formatting */
const EMBEDDED_LANGUAGE_FORMATTINGS = [
  "auto",
  "off",
] as const satisfies readonly EmbeddedLanguageFormattingConfig[];

export const EMBEDDED_LANGUAGE_FORMATTING = {
  AUTO: EMBEDDED_LANGUAGE_FORMATTINGS[0],
  KEPT_OUT: EMBEDDED_LANGUAGE_FORMATTINGS[1],
} as const;

export const oxfmt: OxfmtConfig = defineConfig({
  proseWrap: "never",
  overrides: [
    {
      files: ["**/docs/lint/*.md"],
      options: { embeddedLanguageFormatting: EMBEDDED_LANGUAGE_FORMATTING.KEPT_OUT },
    },
  ],
  sortImports: {
    customGroups: [
      { groupName: "typeBuiltin", selector: "type", elementNamePattern: ["node:*"] },
      { groupName: "typeRepository", selector: "type", elementNamePattern: ["./**", "../**"] },
      { groupName: "typeInstalled", selector: "type" },
    ],
    groups: [
      "builtin",
      "external",
      ["internal", "subpath", "parent", "sibling", "index"],
      "typeBuiltin",
      { newlinesBetween: false },
      "typeInstalled",
      { newlinesBetween: false },
      "typeRepository",
    ],
  },
});
