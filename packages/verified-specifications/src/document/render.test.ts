import { describe, expect, test } from "vite-plus/test";

import { renderSpecificationsDocument } from "./render.ts";

describe("renderSpecificationsDocument", () => {
  test("titles the document with the package name", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/utils",
      subjects: [{ subject: "行の結合", claims: ["各要素を畳む"] }],
    });
    expect(rendered).toContain("# @mst/utils\n");
  });

  test("renders each subject as a heading and each claim as a bullet", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/utils",
      subjects: [{ subject: "行の結合", claims: ["各要素を畳む", "空を空に畳む"] }],
    });
    expect(rendered).toContain("## 行の結合\n\n- 各要素を畳む\n- 空を空に畳む\n");
  });

  test("merges subjects that share a name across files", () => {
    const rendered = renderSpecificationsDocument({
      packageName: "@mst/utils",
      subjects: [
        { subject: "行の結合", claims: ["first"] },
        { subject: "別の主題", claims: ["second"] },
        { subject: "行の結合", claims: ["third"] },
      ],
    });
    expect(rendered).toContain("## 行の結合\n\n- first\n- third\n");
    expect(rendered.match(/## 行の結合/gu)).toHaveLength(1);
  });

  test("states that the file is generated", () => {
    const rendered = renderSpecificationsDocument({ packageName: "@mst/utils", subjects: [] });
    expect(rendered).toContain("生成物");
  });
});
