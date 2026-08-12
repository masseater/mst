import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { nodeVisitsIn } from "./node-visits.ts";
import { flowsOutOf } from "./value-outflow.ts";

const heldFlowsOut = (sourceText: string): boolean => {
  const found = nodeVisitsIn(parseSync("held.ts", sourceText).program).find(
    (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
  );
  if (found === undefined) throw new Error(`no held is written in: ${sourceText}`);
  return flowsOutOf(found.node, found.ancestors);
};

describe("flowsOutOf", () => {
  test("a name standing as a parameter of a function stays where it is written", () => {
    expect(heldFlowsOut("const bump = (held: number) => 1;")).toBe(false);
  });

  test("a name standing as the body of a function is handed out of it", () => {
    expect(heldFlowsOut("const bump = () => held;")).toBe(true);
  });

  test("a name standing on the left of an assignment stays where it is written", () => {
    expect(heldFlowsOut("held = 1;")).toBe(false);
  });

  test("a name standing on the right of an assignment is handed out", () => {
    expect(heldFlowsOut("sink.at = held;")).toBe(true);
  });

  test("a name written inside an object bound to a name is handed out", () => {
    expect(heldFlowsOut("const host = { at: held };")).toBe(true);
  });

  test("a name standing as the value of an object that is returned is handed out", () => {
    expect(heldFlowsOut("const walk = () => { return { at: held }; };")).toBe(true);
  });

  test("a name standing as the tag of a template stays where it is written", () => {
    expect(heldFlowsOut("held`text`;")).toBe(false);
  });

  test("a name standing as the name of a binding stays where it is written", () => {
    expect(heldFlowsOut("const held = 1;")).toBe(false);
  });

  test("a name standing as the value of a binding is handed out", () => {
    expect(heldFlowsOut("const walk = () => { const alias = held; };")).toBe(true);
  });

  test("a name standing as the test of a condition that is returned is handed out", () => {
    expect(heldFlowsOut("const walk = () => { return held ? 1 : 0; };")).toBe(true);
  });

  test("a name standing as the test of a condition that goes nowhere stays where it is written", () => {
    expect(heldFlowsOut("held ? 1 : 0;")).toBe(false);
  });

  test("a name that nothing carries anywhere stays where it is written", () => {
    expect(heldFlowsOut("held;")).toBe(false);
  });
});
