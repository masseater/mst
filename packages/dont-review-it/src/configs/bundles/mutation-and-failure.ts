import { noArrayMutation } from "../../lint/oxlint/rules/mutation-and-failure/no-array-mutation--derive-new-array.ts";
import { noDiscardedFailure } from "../../lint/oxlint/rules/mutation-and-failure/no-discarded-failure--receive-and-surface-it.ts";
import { noEmptyCatch } from "../../lint/oxlint/rules/mutation-and-failure/no-empty-catch--throw-or-handle.ts";
import { noFloatingPromise } from "../../lint/oxlint/rules/mutation-and-failure/no-floating-promise--await-the-result.ts";
import { noLoggedAndContinuedFailure } from "../../lint/oxlint/rules/mutation-and-failure/no-logged-and-continued-failure--stop-or-recover.ts";
import { noPromiseChain } from "../../lint/oxlint/rules/mutation-and-failure/no-promise-chain--use-async-await.ts";
import { noReassign } from "../../lint/oxlint/rules/mutation-and-failure/no-reassign--use-spread-or-iife.ts";
import { noReceiverMutation } from "../../lint/oxlint/rules/mutation-and-failure/no-receiver-mutation--derive-new-value.ts";
import { noSilentCatch } from "../../lint/oxlint/rules/mutation-and-failure/no-silent-catch--rethrow-or-handle.ts";
import { noClassAsMutableCell } from "../../plugin.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";

export const mutationAndFailureBundle: readonly WorkspaceLintRule[] = [
  noArrayMutation,
  noClassAsMutableCell,
  noDiscardedFailure,
  noEmptyCatch,
  noFloatingPromise,
  noLoggedAndContinuedFailure,
  noPromiseChain,
  noReassign,
  noReceiverMutation,
  noSilentCatch,
];
