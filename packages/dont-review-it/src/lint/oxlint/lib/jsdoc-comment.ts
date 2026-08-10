import type { Comment } from "@oxlint/plugins";

export const isJsdoc = (comment: Comment): boolean =>
  comment.type === "Block" && comment.value.startsWith("*");
