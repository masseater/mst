import type { ESTree } from "@oxlint/plugins";

export type NamedReport = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: { readonly name: string };
};
