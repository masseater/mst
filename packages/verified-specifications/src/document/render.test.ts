import { describe, expect, test } from "vite-plus/test";

import { renderSpecificationsDocument } from "./render.ts";

describe("renderSpecificationsDocument", () => {
  test("titles the document with the package name", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/repository-checks",
      subjects: [{ subject: "行の結合", claims: ["各要素を畳む"], sourceFile: "specs/a.spec.ts" }],
    });
    expect(rendered).toContain("# @mst/repository-checks\n");
  });

  test("renders each subject as a heading and each claim as a bullet", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/repository-checks",
      subjects: [
        {
          subject: "行の結合",
          claims: ["各要素を畳む", "空を空に畳む"],
          sourceFile: "specs/a.spec.ts",
        },
      ],
    });
    expect(rendered).toContain("## 行の結合\n");
    expect(rendered).toContain("- 各要素を畳む\n- 空を空に畳む\n");
  });

  test("links each subject to the spec file its claims came from", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/repository-checks",
      subjects: [{ subject: "行の結合", claims: ["各要素を畳む"], sourceFile: "specs/a.spec.ts" }],
    });
    expect(rendered).toContain("## 行の結合\n\n[`specs/a.spec.ts`](specs/a.spec.ts)\n");
  });

  test("merges subjects that share a name and links every source file once", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/repository-checks",
      subjects: [
        { subject: "行の結合", claims: ["first"], sourceFile: "specs/a.spec.ts" },
        { subject: "別の主題", claims: ["second"], sourceFile: "specs/a.spec.ts" },
        { subject: "行の結合", claims: ["third"], sourceFile: "specs/b.spec.ts" },
        { subject: "行の結合", claims: ["fourth"], sourceFile: "specs/b.spec.ts" },
      ],
    });
    expect(rendered).toContain("- first\n- third\n- fourth\n");
    expect(rendered.match(/## 行の結合/gu)).toHaveLength(1);
    expect(rendered).toContain(
      "[`specs/a.spec.ts`](specs/a.spec.ts), [`specs/b.spec.ts`](specs/b.spec.ts)",
    );
  });

  test("states that the file is generated", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/repository-checks",
      subjects: [],
    });
    expect(rendered).toContain("生成物");
  });
});
