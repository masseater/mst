import { defineConfig, type OxfmtConfig } from "oxfmt";

export const oxfmt: OxfmtConfig = defineConfig({
  proseWrap: "never",
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
