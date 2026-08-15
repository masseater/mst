import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  callSignatureOf,
  carriedThroughExpression,
  isPromiseValuedCall,
  isPromiseValuedExpression,
  isPromiseYieldingCallee,
  isWidenedAsyncCall,
  synchronousReturnOfParameter,
} from "../../lib/promise-valued-expressions.ts";
import { type BindingResolution } from "../../lib/resolved-bindings.ts";
import { VOID_OPERATOR } from "../../lib/void-operator.ts";

import type { ESTree } from "@oxlint/plugins";

export const noFloatingPromise = createDontReviewItRule({
  name: "no-floating-promise--await-the-result",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a promise-valued expression that reaches no await, no return, no binding that is later awaited and no composition, so the place a failed asynchronous call lands is fixed by the call site's own control flow",
      relatedGuidelines: [],
    },
    messages: {
      floatingPromiseStatement:
        "A promise-valued expression must not stand alone as a statement. Nothing receives the promise and its failure reaches no `catch` clause. Use one of the four connections: `await` the call, `return` it to the caller, bind it and `await` that binding, or hand it to a composition such as `Promise.all` and `await` the composition. Not needing the result is not the same as not needing the failure. Decide where the failure goes: `await` the call inside a `try` statement and act on it in the `catch` clause.",
      floatingPromiseCallback:
        "A promise-valued argument must not be handed to a parameter that declares a synchronous return. The receiver drops the promise and its failure reaches no `catch` clause. Declare the parameter as a function returning a promise and `await` what it hands back, or keep the callback synchronous. Use one of the four connections inside the receiver: `await` the call, `return` it to the caller, bind it and `await` that binding, or hand it to a composition such as `Promise.all` and `await` the composition. Not needing the result is not the same as not needing the failure.",
      voidedPromise:
        "`void` in front of a promise-valued expression must not stand in for a connection. The promise still reaches nothing and its failure reaches no `catch` clause. Drop the `void` and use one of the four connections: `await` the expression, `return` it to the caller, bind it and `await` that binding, or hand it to a composition such as `Promise.all` and `await` the composition. Not needing the result is not the same as not needing the failure.",
      widenedAsyncCall:
        "A call whose declared type is widened to `any` or `unknown` must not stand alone as a statement while the declaration it resolves to is asynchronous. Nothing receives the promise and its failure reaches no `catch` clause. Declare a type that names what the call yields, then use one of the four connections: `await` the call, `return` it to the caller, bind it and `await` that binding, or hand it to a composition such as `Promise.all` and `await` the composition. Not needing the result is not the same as not needing the failure.",
    },
    schema: [],
  },
  create(inspection) {
    const lookup: BindingResolution = {
      scopeAt: (node) => inspection.sourceCode.getScope(node),
      seenBindings: new Set(),
    };

    return {
      ExpressionStatement(node: ESTree.ExpressionStatement) {
        const expression = carriedThroughExpression(node.expression);

        if (expression.type === "UnaryExpression" && expression.operator === VOID_OPERATOR) {
          if (!isPromiseValuedExpression(expression.argument, lookup)) return;
          inspection.report({ node: expression, messageId: "voidedPromise" });
          return;
        }

        if (expression.type === "CallExpression" && isWidenedAsyncCall(expression, lookup)) {
          inspection.report({ node: expression, messageId: "widenedAsyncCall" });
          return;
        }

        if (!isPromiseValuedCall(expression, lookup)) return;
        inspection.report({ node: expression, messageId: "floatingPromiseStatement" });
      },
      CallExpression(node: ESTree.CallExpression) {
        const signature = callSignatureOf(node.callee, lookup);
        if (signature === null) return;

        node.arguments.forEach((argument, index) => {
          if (argument.type === "SpreadElement") return;
          if (synchronousReturnOfParameter(signature, index) === null) return;
          if (!isPromiseYieldingCallee(argument, lookup)) return;
          inspection.report({ node: argument, messageId: "floatingPromiseCallback" });
        });
      },
    };
  },
});
