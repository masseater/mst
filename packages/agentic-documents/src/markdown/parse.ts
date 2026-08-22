import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import type { Root } from "mdast";

const processing = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);

export const parseMarkdown = (source: string): Root => processing.parse(source);
