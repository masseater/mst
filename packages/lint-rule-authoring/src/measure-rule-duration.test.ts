import { describe, expect, test, vi } from "vite-plus/test";

import { ruleDuration, startLintTelemetry } from "./lint-telemetry.ts";
import { measureVisitor } from "./measure-rule-duration.ts";

vi.mock(import("./lint-telemetry.ts"), { spy: true });

const RULE_NAME = "no-example--do-something";

const VISITED_NODE = { type: "Identifier", name: "alpha" };

const it = test
  .extend("handedVisitor", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    return measureVisitor({
      ruleName: RULE_NAME,
      visitor: { VisitedNode: vi.fn<(node: unknown) => void>() },
    });
  })
  .extend("idleVisitor", ({ handedVisitor }) => {
    vi.mocked(startLintTelemetry).mockReturnValue(false);
    return measureVisitor({ ruleName: RULE_NAME, visitor: handedVisitor });
  })
  .extend("idleRecorder", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(false);
    const record = vi.fn<(elapsed: number, attributes: { rule: string }) => void>();
    vi.mocked(ruleDuration).mockReturnValue({ record });
    const idle = measureVisitor({
      ruleName: RULE_NAME,
      visitor: { VisitedNode: vi.fn<(node: unknown) => void>() },
    });
    (idle.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
    return record;
  })
  .extend("runningRecorder", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.spyOn(performance, "now").mockReturnValue(0);
    const record = vi.fn<(elapsed: number, attributes: { rule: string }) => void>();
    vi.mocked(ruleDuration).mockReturnValue({ record });
    const running = measureVisitor({
      ruleName: RULE_NAME,
      visitor: { VisitedNode: vi.fn<(node: unknown) => void>() },
    });
    (running.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
    return record;
  })
  .extend("wrappedHandler", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.mocked(ruleDuration).mockReturnValue({
      record: vi.fn<(elapsed: number, attributes: { rule: string }) => void>(),
    });
    const handler = vi.fn<(node: unknown) => void>();
    const running = measureVisitor({ ruleName: RULE_NAME, visitor: { VisitedNode: handler } });
    (running.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
    return handler;
  })
  .extend("wrappedHandlerAnswer", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.mocked(ruleDuration).mockReturnValue({
      record: vi.fn<(elapsed: number, attributes: { rule: string }) => void>(),
    });
    const running = measureVisitor({
      ruleName: RULE_NAME,
      visitor: { VisitedNode: () => false },
    });
    return (running.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
  })
  .extend("measuredHandlerNames", () => {
    vi.mocked(startLintTelemetry).mockReturnValue(true);
    vi.mocked(ruleDuration).mockReturnValue({
      record: vi.fn<(elapsed: number, attributes: { rule: string }) => void>(),
    });
    return Object.keys(
      measureVisitor({
        ruleName: RULE_NAME,
        visitor: { VisitedNode: vi.fn<(node: unknown) => void>(), MissingNode: undefined },
      }),
    );
  });

describe("measureVisitor", () => {
  it("hands back the very visitor it was given when telemetry is not running", ({
    handedVisitor,
    idleVisitor,
  }) => {
    expect(idleVisitor).toBe(handedVisitor);
  });

  it("records nothing when telemetry is not running", ({ idleRecorder }) => {
    expect(idleRecorder).not.toHaveBeenCalled();
  });

  it("records the elapsed time under the rule that spent it", ({ runningRecorder }) => {
    expect(runningRecorder).toHaveBeenCalledExactlyOnceWith(0, { rule: RULE_NAME });
  });

  it("still calls the wrapped handler with the node it was given", ({ wrappedHandler }) => {
    expect(wrappedHandler).toHaveBeenCalledExactlyOnceWith(VISITED_NODE);
  });

  it("keeps what the wrapped handler returned", ({ wrappedHandlerAnswer }) => {
    expect(wrappedHandlerAnswer).toBe(false);
  });

  it("drops handlers that were declared but left undefined", ({ measuredHandlerNames }) => {
    expect(measuredHandlerNames).toStrictEqual(["VisitedNode"]);
  });
});
