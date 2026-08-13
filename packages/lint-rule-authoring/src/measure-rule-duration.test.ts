import { describe, expect, test, vi } from "vite-plus/test";

import { ruleDuration, startLintTelemetry } from "./lint-telemetry.ts";
import { measureVisitor } from "./measure-rule-duration.ts";

vi.mock(import("./lint-telemetry.ts"), { spy: true });

const RULE_NAME = "no-example--do-something";

const VISITED_NODE = { type: "Identifier", name: "alpha" };

describe("measureVisitor", () => {
  describe("telemetry that is not running", () => {
    describe("the visitor it hands back", () => {
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
        });

      it("is the very visitor it was given", ({ handedVisitor, idleVisitor }) => {
        expect(idleVisitor).toBe(handedVisitor);
      });
    });

    describe("the recorder behind a handler that was visited", () => {
      const it = test.extend("idleRecorder", () => {
        vi.mocked(startLintTelemetry).mockReturnValue(false);
        const durationRecorder = vi.fn<(elapsed: number, attributes: { rule: string }) => void>();
        vi.mocked(ruleDuration).mockReturnValue({ record: durationRecorder });
        const idle = measureVisitor({
          ruleName: RULE_NAME,
          visitor: { VisitedNode: vi.fn<(node: unknown) => void>() },
        });
        (idle.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
        return durationRecorder;
      });

      it("is never asked to record anything", ({ idleRecorder }) => {
        expect(idleRecorder).not.toHaveBeenCalled();
      });
    });
  });

  describe("telemetry that is running", () => {
    describe("the recorder behind a handler that was visited", () => {
      const it = test.extend("runningRecorder", () => {
        vi.mocked(startLintTelemetry).mockReturnValue(true);
        vi.spyOn(performance, "now").mockReturnValue(0);
        const durationRecorder = vi.fn<(elapsed: number, attributes: { rule: string }) => void>();
        vi.mocked(ruleDuration).mockReturnValue({ record: durationRecorder });
        const running = measureVisitor({
          ruleName: RULE_NAME,
          visitor: { VisitedNode: vi.fn<(node: unknown) => void>() },
        });
        (running.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
        return durationRecorder;
      });

      it("receives the elapsed time under the rule that spent it", ({ runningRecorder }) => {
        expect(runningRecorder).toHaveBeenCalledExactlyOnceWith(0, { rule: RULE_NAME });
      });
    });

    describe("the handler the measured visitor wraps", () => {
      const it = test.extend("wrappedHandler", () => {
        vi.mocked(startLintTelemetry).mockReturnValue(true);
        vi.mocked(ruleDuration).mockReturnValue({
          record: vi.fn<(elapsed: number, attributes: { rule: string }) => void>(),
        });
        const visitedNodeHandler = vi.fn<(node: unknown) => void>();
        const running = measureVisitor({
          ruleName: RULE_NAME,
          visitor: { VisitedNode: visitedNodeHandler },
        });
        (running.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
        return visitedNodeHandler;
      });

      it("is still called with the node the visit carried", ({ wrappedHandler }) => {
        expect(wrappedHandler).toHaveBeenCalledExactlyOnceWith(VISITED_NODE);
      });
    });

    describe("what a visit through the measured visitor returns", () => {
      const it = test.extend("wrappedHandlerAnswer", () => {
        vi.mocked(startLintTelemetry).mockReturnValue(true);
        vi.mocked(ruleDuration).mockReturnValue({
          record: vi.fn<(elapsed: number, attributes: { rule: string }) => void>(),
        });
        const running = measureVisitor({
          ruleName: RULE_NAME,
          visitor: { VisitedNode: () => false },
        });
        return (running.VisitedNode as (node: unknown) => unknown)(VISITED_NODE);
      });

      it("is what the wrapped handler returned", ({ wrappedHandlerAnswer }) => {
        expect(wrappedHandlerAnswer).toBe(false);
      });
    });

    describe("a visitor declaring a handler that was left undefined", () => {
      const it = test.extend("measuredHandlerNames", () => {
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

      it("keeps only the handler that was defined", ({ measuredHandlerNames }) => {
        expect(measuredHandlerNames).toStrictEqual(["VisitedNode"]);
      });
    });
  });
});
