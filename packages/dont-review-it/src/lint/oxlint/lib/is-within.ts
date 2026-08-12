type ParentNode = { readonly parent: ParentNode | null };

export const isWithin = (node: ParentNode, ancestor: ParentNode): boolean => {
  if (node === ancestor) return true;
  return node.parent !== null && isWithin(node.parent, ancestor);
};
