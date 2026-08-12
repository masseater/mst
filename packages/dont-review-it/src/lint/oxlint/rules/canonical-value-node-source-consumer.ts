import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { propertyPathsEqual } from "../lib/canonical-values/property-path.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";
import { canonicalValueImportedDefinitionName } from "./canonical-value-imported-name.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  canonicalValueExpressionOrigin,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { canonicalValueStandardPathIsStable } from "./canonical-value-standard-stability.ts";

import type { Definition, ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation-types.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

const CHILD_PROCESS_SPECIFIERS: ReadonlySet<string> = new Set([
  "child_process",
  "node:child_process",
]);
const CHILD_PROCESS_METHODS: ReadonlySet<string> = new Set([
  "execFile",
  "execFileSync",
  "fork",
  "spawn",
  "spawnSync",
]);
const FILE_SYSTEM_SPECIFIERS: ReadonlySet<string> = new Set(["fs", "node:fs"]);
const FILE_SYSTEM_PROMISE_SPECIFIERS: ReadonlySet<string> = new Set([
  "fs/promises",
  "node:fs/promises",
]);
const FILE_SYSTEM_READ_SPECIFIERS: ReadonlySet<string> = new Set([
  ...FILE_SYSTEM_SPECIFIERS,
  ...FILE_SYSTEM_PROMISE_SPECIFIERS,
]);
const READ_FILE_METHODS: ReadonlySet<string> = new Set(["readFile"]);
const READ_FILE_SYNC_METHODS: ReadonlySet<string> = new Set(["readFileSync"]);

export const canonicalValueDefinitionIsAmbientVariable = (definition: Definition): boolean => {
  const node = definition.node;
  return (
    node.type === "VariableDeclarator" &&
    node.init === null &&
    node.parent.type === "VariableDeclaration" &&
    node.parent.declare === true
  );
};

export const canonicalValueExpressionIsRequire = (
  bindingIndex: CanonicalValueBindingIndex,
  expression: ESTree.Expression,
): boolean => {
  if (expression.type !== "Identifier" || expression.name !== "require") return false;
  const binding = bindingIndex.resolveIdentifier(expression);
  return (
    binding === null ||
    bindingIndex.definitionsOf(binding).length === 0 ||
    bindingIndex.definitionsOf(binding).every(canonicalValueDefinitionIsAmbientVariable)
  );
};

const expressionLoadsModule = (
  bindingIndex: CanonicalValueBindingIndex,
  input: { readonly expression: ESTree.Expression; readonly specifiers: ReadonlySet<string> },
): boolean => {
  const expression = unwrapExpression(input.expression);
  if (expression.type !== "CallExpression") return false;
  const callee = unwrapExpression(expression.callee);
  const source = expression.arguments[0];
  return (
    canonicalValueExpressionIsRequire(bindingIndex, callee) &&
    source?.type === "Literal" &&
    typeof source.value === "string" &&
    input.specifiers.has(source.value)
  );
};

const definitionImportedName = (
  definition: Definition,
  specifiers: ReadonlySet<string>,
): string | null => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return declaration !== null && specifiers.has(declaration.source.value)
    ? canonicalValueImportedDefinitionName(definition)
    : null;
};

const definitionImportsModuleObject = (
  definition: Definition,
  specifiers: ReadonlySet<string>,
): boolean => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return (
    declaration !== null &&
    specifiers.has(declaration.source.value) &&
    (definition.node.type === "ImportNamespaceSpecifier" ||
      definition.node.type === "ImportDefaultSpecifier")
  );
};

const directImportedMethodName = (
  bindingIndex: CanonicalValueBindingIndex,
  input: {
    readonly methods: ReadonlySet<string>;
    readonly origin: CanonicalValueExpressionOrigin & {
      readonly expression: ESTree.IdentifierReference;
    };
    readonly specifiers: ReadonlySet<string>;
  },
): string | null => {
  const binding = bindingIndex.resolveIdentifier(input.origin.expression);
  if (binding === null) return null;
  return (
    bindingIndex
      .definitionsOf(binding)
      .map((definition) => definitionImportedName(definition, input.specifiers))
      .find((name) => name !== null && input.methods.has(name)) ?? null
  );
};

const namespaceMethodName = (
  bindingIndex: CanonicalValueBindingIndex,
  input: {
    readonly method: string;
    readonly origin: CanonicalValueExpressionOrigin & {
      readonly expression: ESTree.IdentifierReference;
    };
    readonly specifiers: ReadonlySet<string>;
  },
): string | null => {
  const binding = bindingIndex.resolveIdentifier(input.origin.expression);
  return binding !== null &&
    bindingIndex
      .definitionsOf(binding)
      .some((definition) => definitionImportsModuleObject(definition, input.specifiers))
    ? input.method
    : null;
};

const projectedImportedMethodName = (
  bindingIndex: CanonicalValueBindingIndex,
  input: {
    readonly method: string;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly specifiers: ReadonlySet<string>;
  },
): string | null => {
  if (
    expressionLoadsModule(bindingIndex, {
      expression: input.origin.expression,
      specifiers: input.specifiers,
    })
  ) {
    return input.method;
  }
  if (input.origin.expression.type !== "Identifier") return null;
  return namespaceMethodName(bindingIndex, {
    method: input.method,
    origin: { ...input.origin, expression: input.origin.expression },
    specifiers: input.specifiers,
  });
};

const importedMethodName = (
  bindingIndex: CanonicalValueBindingIndex,
  input: {
    readonly methods: ReadonlySet<string>;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly specifiers: ReadonlySet<string>;
  },
): string | null => {
  const path = canonicalValueInvocationPropertyPath(input.origin);
  if (path === null) return null;
  if (path.length === 0) {
    if (input.origin.expression.type !== "Identifier") return null;
    return directImportedMethodName(bindingIndex, {
      ...input,
      origin: { ...input.origin, expression: input.origin.expression },
    });
  }
  const [method] = path;
  if (path.length !== 1 || method === undefined || !input.methods.has(method)) return null;
  return projectedImportedMethodName(bindingIndex, {
    method,
    origin: input.origin,
    specifiers: input.specifiers,
  });
};

const argumentOrigins = (
  invocationState: CanonicalValueInvocationState,
  input: { readonly fact: CanonicalValueInvocationFact; readonly index: number },
): readonly CanonicalValueOrigin[] =>
  invocationState.argumentOrigins(input.fact, input.index).candidates;

const originIsProcessExecPath = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly origin: CanonicalValueOrigin;
  readonly propertyState: CanonicalValuePropertyState;
}): boolean => {
  if (input.origin.kind !== "expression") return false;
  const path = canonicalValueInvocationPropertyPath(input.origin);
  return (
    path?.length === 1 &&
    path[0] === "execPath" &&
    canonicalValueIsGlobalIdentifier(input.bindingIndex, {
      expression: input.origin.expression,
      name: "process",
    }) &&
    canonicalValueStandardPathIsStable(
      {
        bindingIndex: input.bindingIndex,
        execution: input.propertyState.execution,
      },
      {
        cutoff: input.origin.expression.start,
        executionContext: input.bindingIndex.executionContextAt(input.origin.expression),
        path: ["process", "execPath"],
      },
    )
  );
};

const directArrayFirstOrigin = (origin: CanonicalValueOrigin): readonly CanonicalValueOrigin[] => {
  if (origin.kind === "absent" || origin.projections.length !== 0) return [origin];
  const expression = unwrapExpression(origin.expression);
  if (expression.type !== "ArrayExpression") return [origin];
  const first = expression.elements[0];
  return first === null || first === undefined
    ? []
    : [canonicalValueExpressionOrigin(first.type === "SpreadElement" ? first.argument : first)];
};

const childProcessOrigins = (
  bindingIndex: CanonicalValueBindingIndex,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly invocationState: CanonicalValueInvocationState;
    readonly propertyState: CanonicalValuePropertyState;
  },
): readonly CanonicalValueOrigin[] => {
  const method = importedMethodName(bindingIndex, {
    methods: CHILD_PROCESS_METHODS,
    origin: input.fact.target,
    specifiers: CHILD_PROCESS_SPECIFIERS,
  });
  if (method === null) return [];
  if (method === "fork")
    return argumentOrigins(input.invocationState, { fact: input.fact, index: 0 });
  const executables = argumentOrigins(input.invocationState, { fact: input.fact, index: 0 });
  if (
    !executables.some((origin) =>
      originIsProcessExecPath({ bindingIndex, origin, propertyState: input.propertyState }),
    )
  ) {
    return [];
  }
  return argumentOrigins(input.invocationState, { fact: input.fact, index: 1 }).flatMap(
    directArrayFirstOrigin,
  );
};

const importedFileSystemPromisesRead = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path === null || origin.expression.type !== "Identifier") return false;
  const binding = bindingIndex.resolveIdentifier(origin.expression);
  if (binding === null) return false;
  const definitions = bindingIndex.definitionsOf(binding);
  return (
    (propertyPathsEqual(path, ["promises", "readFile"]) &&
      definitions.some((definition) =>
        definitionImportsModuleObject(definition, FILE_SYSTEM_SPECIFIERS),
      )) ||
    (propertyPathsEqual(path, ["readFile"]) &&
      definitions.some(
        (definition) => definitionImportedName(definition, FILE_SYSTEM_SPECIFIERS) === "promises",
      ))
  );
};

const originIsFileSystemPromisesRead = (
  bindingIndex: CanonicalValueBindingIndex,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path === null || !propertyPathsEqual(path, ["promises", "readFile"])) {
    return importedFileSystemPromisesRead(bindingIndex, origin);
  }
  return (
    expressionLoadsModule(bindingIndex, {
      expression: origin.expression,
      specifiers: FILE_SYSTEM_SPECIFIERS,
    }) || importedFileSystemPromisesRead(bindingIndex, origin)
  );
};

const originCanNameFile = (origin: CanonicalValueOrigin): boolean => {
  if (origin.kind === "absent") return false;
  const expression = unwrapExpression(origin.expression);
  return expression.type !== "Literal" || typeof expression.value === "string";
};

const fileReadOrigins = (
  bindingIndex: CanonicalValueBindingIndex,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly invocationState: CanonicalValueInvocationState;
  },
): readonly CanonicalValueOrigin[] => {
  const synchronous = importedMethodName(bindingIndex, {
    methods: READ_FILE_SYNC_METHODS,
    origin: input.fact.target,
    specifiers: FILE_SYSTEM_SPECIFIERS,
  });
  const asynchronous = importedMethodName(bindingIndex, {
    methods: READ_FILE_METHODS,
    origin: input.fact.target,
    specifiers: FILE_SYSTEM_READ_SPECIFIERS,
  });
  const promisesRead = originIsFileSystemPromisesRead(bindingIndex, input.fact.target);
  return synchronous === null && asynchronous === null && !promisesRead
    ? []
    : argumentOrigins(input.invocationState, { fact: input.fact, index: 0 }).filter(
        originCanNameFile,
      );
};

export const canonicalValueNodeSourceConsumerOrigins = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly invocationState: CanonicalValueInvocationState;
  readonly facts: readonly CanonicalValueInvocationFact[];
  readonly propertyState: CanonicalValuePropertyState;
}): readonly CanonicalValueOrigin[] =>
  input.facts.flatMap((fact) => [
    ...childProcessOrigins(input.bindingIndex, {
      fact,
      invocationState: input.invocationState,
      propertyState: input.propertyState,
    }),
    ...fileReadOrigins(input.bindingIndex, { fact, invocationState: input.invocationState }),
  ]);
