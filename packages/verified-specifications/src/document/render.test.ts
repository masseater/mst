import { describe, expect, test } from "vite-plus/test";

import { renderSpecificationsDocument } from "./render.ts";

describe("renderSpecificationsDocument", () => {
  describe("a package whose specifications named no subject", () => {
    const it = test.extend("documentText", () =>
      renderSpecificationsDocument({ packageName: "@mst/repository-checks", subjects: [] }));

    it("titles the document with the package name, above the line that says it is generated", ({
      documentText,
    }) => {
      expect(documentText).toMatchInlineSnapshot(`
        "# @mst/repository-checks

        生成物。\`vp run guard:fix\` が \`specs/\` の仕様担保テストから再生成する。手で編集しない。
        "
      `);
    });
  });

  describe("a subject read from a single spec file", () => {
    const it = test.extend("documentText", () =>
      renderSpecificationsDocument({
        packageName: "@mst/repository-checks",
        subjects: [
          { subject: "行の結合", claims: ["各要素を畳む"], sourceFile: "specs/a.spec.ts" },
        ],
      }));

    it("heads the subject and links the spec file its claims came from", ({ documentText }) => {
      expect(documentText).toMatchInlineSnapshot(`
        "# @mst/repository-checks

        生成物。\`vp run guard:fix\` が \`specs/\` の仕様担保テストから再生成する。手で編集しない。

        ## 行の結合

        [\`specs/a.spec.ts\`](specs/a.spec.ts)

        - 各要素を畳む
        "
      `);
    });
  });

  describe("a subject carrying several claims", () => {
    const it = test.extend("documentText", () =>
      renderSpecificationsDocument({
        packageName: "@mst/repository-checks",
        subjects: [
          {
            subject: "行の結合",
            claims: ["各要素を畳む", "空を空に畳む"],
            sourceFile: "specs/a.spec.ts",
          },
        ],
      }));

    it("bullets every claim under the heading of its subject", ({ documentText }) => {
      expect(documentText).toMatchInlineSnapshot(`
        "# @mst/repository-checks

        生成物。\`vp run guard:fix\` が \`specs/\` の仕様担保テストから再生成する。手で編集しない。

        ## 行の結合

        [\`specs/a.spec.ts\`](specs/a.spec.ts)

        - 各要素を畳む
        - 空を空に畳む
        "
      `);
    });
  });

  describe("one subject named by several spec files beside another subject", () => {
    const it = test.extend("documentText", () =>
      renderSpecificationsDocument({
        packageName: "@mst/repository-checks",
        subjects: [
          { subject: "行の結合", claims: ["first"], sourceFile: "specs/a.spec.ts" },
          { subject: "別の主題", claims: ["second"], sourceFile: "specs/a.spec.ts" },
          { subject: "行の結合", claims: ["third"], sourceFile: "specs/b.spec.ts" },
          { subject: "行の結合", claims: ["fourth"], sourceFile: "specs/b.spec.ts" },
        ],
      }));

    it("merges the shared subject into one heading and links each of its files once", ({
      documentText,
    }) => {
      expect(documentText).toMatchInlineSnapshot(`
        "# @mst/repository-checks

        生成物。\`vp run guard:fix\` が \`specs/\` の仕様担保テストから再生成する。手で編集しない。

        ## 行の結合

        [\`specs/a.spec.ts\`](specs/a.spec.ts), [\`specs/b.spec.ts\`](specs/b.spec.ts)

        - first
        - third
        - fourth

        ## 別の主題

        [\`specs/a.spec.ts\`](specs/a.spec.ts)

        - second
        "
      `);
    });
  });
});
