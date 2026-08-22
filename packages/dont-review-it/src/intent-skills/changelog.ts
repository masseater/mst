import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { frontmatter } from "micromark-extension-frontmatter";

const ATX_LEVEL_TWO_PREFIX_PATTERN = /^ {0,3}##(?:[\t ]+|$)/u;

export const declaresVersion = ({
  source,
  version,
}: {
  readonly source: string;
  readonly version: string;
}): boolean => {
  const document = fromMarkdown(source, {
    extensions: [frontmatter(["yaml"])],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
  });

  return document.children.some((node) => {
    if (node.type !== "heading" || node.depth !== 2 || node.children.length !== 1) return false;

    const [headingContent] = node.children;
    const offset = node.position?.start.offset;
    return (
      headingContent?.type === "text" &&
      headingContent.value === version &&
      offset !== undefined &&
      ATX_LEVEL_TWO_PREFIX_PATTERN.test(source.slice(offset))
    );
  });
};
