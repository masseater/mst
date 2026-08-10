import { describe, expect, it, vi } from "vite-plus/test";

import { ruleDuration, startLintTelemetry } from "./lint-telemetry.ts";
import { measureVisitor } from "./measure-rule-duration.ts";

import type { Visitor } from "@oxlint/plugins";

vi.mock(import("./lint-telemetry.ts"), () => ({
  ruleDuration: vi.fn<typeof ruleDuration>(),
  startLintTelemetry: vi.fn<typeof startLintTelemetry>(),
}));

const RULE_NAME = "no-example--do-something";

const VISITED_NODE = { type: "Identifier", name: "alpha" };

const visit = (visitor: Visitor): unknown =>
  (visitor.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);

const recorder = () => vi.fn<(elapsed: number, attributes: { rule: string }) => void>();

const handlerSpy = () => vi.fn<(node: unknown) => void>();

describe("measureVisitor", () => {
  it("hands back the same visitor when telemetry is not running", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(false);
    const visitor = { VisitedNode: (): undefined => undefined };

    expect(measureVisitor({ ruleName: RULE_NAME, visitor })).toBe(visitor);
  });

  it("records nothing when telemetry is not running", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(false);
    const record = recorder();
    vi.mocked(ruleDuration).mockReturnValue({ record });

    visit(measureVisitor({ ruleName: RULE_NAME, visitor: { VisitedNode: handlerSpy() } }));

    expect(record).not.toHaveBeenCalled();
  });

  it("records the elapsed time under the rule that spent it", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    const record = recorder();
    vi.mocked(ruleDuration).mockReturnValue({ record });

    visit(measureVisitor({ ruleName: RULE_NAME, visitor: { VisitedNode: handlerSpy() } }));

    expect(record).toHaveBeenCalledExactlyOnceWith(expect.any(Number), { rule: RULE_NAME });
  });

  it("still calls the wrapped handler with the node it was given", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.mocked(ruleDuration).mockReturnValue({ record: recorder() });
    const handler = handlerSpy();

    visit(measureVisitor({ ruleName: RULE_NAME, visitor: { VisitedNode: handler } }));

    expect(handler).toHaveBeenCalledExactlyOnceWith(VISITED_NODE);
  });

  it("keeps what the wrapped handler returned", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.mocked(ruleDuration).mockReturnValue({ record: recorder() });

    const returned = visit(
      measureVisitor({ ruleName: RULE_NAME, visitor: { VisitedNode: () => false } }),
    );

    expect(returned).toBe(false);
  });

  it("drops handlers that were declared but left undefined", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.mocked(ruleDuration).mockReturnValue({ record: recorder() });

    const measured = measureVisitor({
      ruleName: RULE_NAME,
      visitor: { VisitedNode: handlerSpy(), MissingNode: undefined },
    });

    expect(Object.keys(measured)).toStrictEqual(["VisitedNode"]);
  });
});
