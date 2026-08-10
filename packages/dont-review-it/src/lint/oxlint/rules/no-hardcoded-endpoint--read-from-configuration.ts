import { createDontReviewItRule } from "../../../create-rule.ts";
import { withoutParentheses } from "../lib/parenthesized-expression.ts";
import { staticMemberOf } from "../lib/static-member.ts";
import { hasWrittenOutText } from "../lib/written-out-text.ts";

import type { ESTree } from "@oxlint/plugins";

type DestinationTaker = ESTree.CallExpression | ESTree.NewExpression;

const FETCH_NAME = "fetch";

const SEND_BEACON_NAME = "sendBeacon";

const NAVIGATOR_OBJECT_NAME = "navigator";

const CONNECTION_CONSTRUCTOR_NAMES: ReadonlySet<string> = new Set([
  "EventSource",
  "Request",
  "WebSocket",
]);

const isNavigatorSendBeacon = (callee: ESTree.Expression): boolean => {
  const member = staticMemberOf(callee);
  if (member === null || member.name !== SEND_BEACON_NAME) return false;
  const receiver = withoutParentheses(member.object);
  return receiver.type === "Identifier" && receiver.name === NAVIGATOR_OBJECT_NAME;
};

const isFetchCallee = (callee: ESTree.Expression): boolean => {
  const written = withoutParentheses(callee);
  if (written.type === "Identifier") return written.name === FETCH_NAME;
  const member = staticMemberOf(written);
  return member !== null && member.name === FETCH_NAME;
};

const isConnectionConstructor = (callee: ESTree.Expression): boolean => {
  const written = withoutParentheses(callee);
  return written.type === "Identifier" && CONNECTION_CONSTRUCTOR_NAMES.has(written.name);
};

const takesADestination = (node: DestinationTaker): boolean =>
  node.type === "NewExpression"
    ? isConnectionConstructor(node.callee)
    : isFetchCallee(node.callee) || isNavigatorSendBeacon(node.callee);

const writtenOutDestinationOf = (node: DestinationTaker): ESTree.Expression | null => {
  if (!takesADestination(node)) return null;
  const [destination] = node.arguments;
  if (destination === undefined || destination.type === "SpreadElement") return null;
  return hasWrittenOutText(destination) ? destination : null;
};

export const noHardcodedEndpoint = createDontReviewItRule({
  name: "no-hardcoded-endpoint--read-from-configuration",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow text written out in the source at the destination argument of a call that opens a connection, so where a deployment talks to is decided by its configuration rather than by the file that performs the request",
      relatedGuidelines: [],
    },
    messages: {
      hardcodedEndpoint:
        "A call that opens a connection must not take its destination from text written out in this file, because the destination is the one part of a request that differs between every deployment: the same source has to reach a local stub under test, a staging host during review, and the real host in production, and text baked into the call can be none of those without an edit. What follows is a build that only runs where its author ran it, a test suite that either talks to a real host or is rewritten per environment, and a wrong destination that no type and no test can catch because the value never leaves this line. Read the destination from configuration and pass it in: take it from the environment the process was started with, or accept it as a parameter of the function that performs the request so the caller decides. Whether the text looks like a URL is not what is being reported. Any written-out text at this argument is, because this argument is where the connection goes.",
    },
    schema: [],
  },
  create(context) {
    const reportWrittenOutDestination = (node: DestinationTaker) => {
      const destination = writtenOutDestinationOf(node);
      if (destination === null) return;
      context.report({ node: destination, messageId: "hardcodedEndpoint" });
    };

    return {
      CallExpression: reportWrittenOutDestination,
      NewExpression: reportWrittenOutDestination,
    };
  },
});
