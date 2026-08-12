import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueOriginUsesGlobalObject } from "./canonical-value-browser-global-origin.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";
import { canonicalValueImportedDefinitionName } from "./canonical-value-imported-name.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import { NODE_MODULE_SPECIFIERS } from "./canonical-value-module-loader.ts";
import {
  canonicalValueExpressionIsRequire,
  canonicalValueNodeSourceConsumerOrigins,
} from "./canonical-value-node-source-consumer.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  canonicalValueDirectWorkletModuleOrigin,
  canonicalValueOriginIsWorkletAddModule,
} from "./canonical-value-worklet-consumer.ts";

import type { Definition, ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

const WORKER_THREAD_SPECIFIERS: ReadonlySet<string> = new Set([
  "node:worker_threads",
  "worker_threads",
]);

const definitionImportsWorker = (definition: Definition): boolean => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return (
    declaration !== null &&
    WORKER_THREAD_SPECIFIERS.has(declaration.source.value) &&
    canonicalValueImportedDefinitionName(definition) === "Worker"
  );
};

const definitionImportsWorkerNamespace = (definition: Definition): boolean => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return (
    declaration !== null &&
    WORKER_THREAD_SPECIFIERS.has(declaration.source.value) &&
    definition.node.type === "ImportNamespaceSpecifier"
  );
};

const definitionImportsModuleRegister = (definition: Definition): boolean => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return (
    declaration !== null &&
    NODE_MODULE_SPECIFIERS.has(declaration.source.value) &&
    canonicalValueImportedDefinitionName(definition) === "register"
  );
};

const definitionImportsModuleNamespace = (definition: Definition): boolean => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return (
    declaration !== null &&
    NODE_MODULE_SPECIFIERS.has(declaration.source.value) &&
    definition.node.type === "ImportNamespaceSpecifier"
  );
};

const expressionLoadsModule = (
  bindingIndex: CanonicalValueBindingIndex,
  input: { readonly expression: ESTree.Expression; readonly specifiers: ReadonlySet<string> },
): boolean => {
  const unwrapped = unwrapExpression(input.expression);
  if (unwrapped.type !== "CallExpression") return false;
  const callee = unwrapExpression(unwrapped.callee);
  const source = unwrapped.arguments[0];
  return (
    canonicalValueExpressionIsRequire(bindingIndex, callee) &&
    source?.type === "Literal" &&
    typeof source.value === "string" &&
    input.specifiers.has(source.value)
  );
};

const expressionLoadsWorkerThreads = (
  bindingIndex: CanonicalValueBindingIndex,
  expression: ESTree.Expression,
): boolean =>
  expressionLoadsModule(bindingIndex, { expression, specifiers: WORKER_THREAD_SPECIFIERS });

const originIsImportedWorker = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path === null) return false;
  if (path.length === 1 && path[0] === "Worker") {
    if (expressionLoadsWorkerThreads(bindingIndex, origin.expression)) return true;
    if (origin.expression.type !== "Identifier") return false;
    const namespace = bindingIndex.resolveIdentifier(origin.expression);
    return (
      namespace !== null &&
      bindingIndex.definitionsOf(namespace).some(definitionImportsWorkerNamespace)
    );
  }
  if (path.length !== 0 || origin.expression.type !== "Identifier") return false;
  const binding = bindingIndex.resolveIdentifier(origin.expression);
  return binding !== null && bindingIndex.definitionsOf(binding).some(definitionImportsWorker);
};

const originIsGlobalConstructor = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const direct = ["SharedWorker", "Worker"].some((name) =>
    canonicalValueIsGlobalIdentifier(bindingIndex, { expression: origin.expression, name }),
  );
  return (
    (canonicalValueInvocationPropertyPath(origin)?.length === 0 && direct) ||
    canonicalValueOriginUsesGlobalObject({ bindingIndex, origin, path: ["Worker"] }) ||
    canonicalValueOriginUsesGlobalObject({ bindingIndex, origin, path: ["SharedWorker"] })
  );
};

const originIsGlobalImportScripts = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  return (
    (path?.length === 0 &&
      canonicalValueIsGlobalIdentifier(bindingIndex, {
        expression: origin.expression,
        name: "importScripts",
      })) ||
    canonicalValueOriginUsesGlobalObject({ bindingIndex, origin, path: ["importScripts"] })
  );
};

const originIsImportedModuleRegister = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (origin.expression.type !== "Identifier" || path === null) return false;
  const binding = bindingIndex.resolveIdentifier(origin.expression);
  if (binding === null) return false;
  if (path.length === 0) {
    return bindingIndex.definitionsOf(binding).some(definitionImportsModuleRegister);
  }
  return (
    path.length === 1 &&
    path[0] === "register" &&
    bindingIndex.definitionsOf(binding).some(definitionImportsModuleNamespace)
  );
};

const originIsServiceWorkerRegister = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  return (
    (path?.length === 2 &&
      path[0] === "serviceWorker" &&
      path[1] === "register" &&
      canonicalValueIsGlobalIdentifier(bindingIndex, {
        expression: origin.expression,
        name: "navigator",
      })) ||
    canonicalValueOriginUsesGlobalObject({
      bindingIndex,
      origin,
      path: ["navigator", "serviceWorker", "register"],
    })
  );
};

const originConsumesBrowserModule = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  return (
    originIsGlobalConstructor(bindingIndex, origin) ||
    originIsGlobalImportScripts(bindingIndex, origin) ||
    originIsServiceWorkerRegister(bindingIndex, origin) ||
    canonicalValueOriginIsWorkletAddModule({ bindingIndex, origin })
  );
};

const originConsumesNodeModule = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean =>
  originIsImportedWorker(bindingIndex, origin) ||
  originIsImportedModuleRegister(bindingIndex, origin);

type ModuleConsumerInput = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
};

export const canonicalValueBrowserModuleConsumerOrigins = (
  input: ModuleConsumerInput,
): readonly CanonicalValueOrigin[] =>
  uniqBy(
    [
      ...input.invocationState
        .facts(input.invocation)
        .candidates.flatMap((fact) =>
          originConsumesBrowserModule(input.bindingIndex, fact.target)
            ? input.invocationState.argumentOrigins(fact, 0).candidates
            : [],
        ),
      ...((origin) => (origin === null ? [] : [origin]))(
        canonicalValueDirectWorkletModuleOrigin({
          bindingIndex: input.bindingIndex,
          invocation: input.invocation,
        }),
      ),
    ],
    canonicalValueOriginKey,
  );

export const canonicalValueModuleConsumerOrigins = (
  input: ModuleConsumerInput,
): readonly CanonicalValueOrigin[] => {
  const facts = input.invocationState.facts(input.invocation).candidates;
  return uniqBy(
    [
      ...canonicalValueBrowserModuleConsumerOrigins(input),
      ...facts.flatMap((fact) =>
        originConsumesNodeModule(input.bindingIndex, fact.target)
          ? input.invocationState.argumentOrigins(fact, 0).candidates
          : [],
      ),
      ...canonicalValueNodeSourceConsumerOrigins({
        bindingIndex: input.bindingIndex,
        facts,
        invocationState: input.invocationState,
        propertyState: input.propertyState,
      }),
    ],
    canonicalValueOriginKey,
  );
};
