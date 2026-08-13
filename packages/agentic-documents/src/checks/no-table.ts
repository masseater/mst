import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { descendants, lineOf, offsetOf } from "../markdown/nodes.ts";

import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const COMPLAINT =
  "規範を表の行として書くことは禁止されている。各行を `IF: <条件>; THEN <キーワード>: <行動>` の項目に書き直す。規範ではない一覧であれば、規範文書の外へ移す。";

export const tablesInNormativeDocument = (
  document: NormativeDocument,
): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "table")
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .map((node) => ({ file: document.file, line: lineOf(node), message: COMPLAINT }));
