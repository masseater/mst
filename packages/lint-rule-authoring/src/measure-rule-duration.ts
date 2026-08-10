import { ruleDuration, startLintTelemetry } from "./lint-telemetry.ts";

import type { Visitor } from "@oxlint/plugins";

const measured = ({
  ruleName,
  handler,
}: {
  readonly ruleName: string;
  readonly handler: (...args: readonly never[]) => unknown;
}): ((...args: readonly never[]) => unknown) => {
  return (...args) => {
    const startedAt = performance.now();
    const handled = handler(...args);
    ruleDuration().record(performance.now() - startedAt, { rule: ruleName });
    return handled;
  };
};

export const measureVisitor = ({
  ruleName,
  visitor,
}: {
  readonly ruleName: string;
  readonly visitor: Visitor;
}): Visitor => {
  if (!startLintTelemetry()) {
    return visitor;
  }
  return Object.fromEntries(
    Object.entries(visitor).flatMap(([nodeType, handler]) =>
      handler === undefined ? [] : [[nodeType, measured({ ruleName, handler })] as const],
    ),
  );
};
