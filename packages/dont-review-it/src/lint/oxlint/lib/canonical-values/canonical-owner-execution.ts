import * as ts from "typescript-6";

import {
  canonicalOwnerAliasedCalledFunctions,
  canonicalOwnerFunctionInvocations,
  canonicalOwnerNodesInContext,
  type CanonicalOwnerFunctionInvocation,
} from "./canonical-owner-call.ts";
import {
  addCanonicalOwnerCallableAliases,
  canonicalOwnerCallbackFunctions,
  canonicalOwnerPromiseExecutorFunctions,
} from "./canonical-owner-execution-callback.ts";
import { canonicalOwnerProtocolFunctions } from "./canonical-owner-execution-protocol.ts";
import { canonicalOwnerNodeIsSyntacticallyReachable } from "./canonical-owner-reachability.ts";
import {
  canonicalOwnerDeclarationInitializer,
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const advancedGeneratorFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
}): readonly ExecutableFunction[] => {
  if (canonicalOwnerMemberName(input.call.expression) !== "next") return [];
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const current = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  return current !== null && ts.isCallExpression(current)
    ? canonicalOwnerAliasedCalledFunctions({
        aliases: input.aliases,
        checker: input.checker,
        expression: current.expression,
      }).filter((function_) => function_.asteriskToken !== undefined)
    : [];
};

const calledFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
}): readonly ExecutableFunction[] => [
  ...directFunctionInvocations(input)
    .map((invocation) => invocation.function_)
    .filter((function_) => function_.asteriskToken === undefined),
  ...advancedGeneratorFunctions(input),
  ...canonicalOwnerCallbackFunctions(input),
];

const directFunctionInvocations = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly CanonicalOwnerFunctionInvocation[] =>
  canonicalOwnerFunctionInvocations({
    aliases: input.aliases,
    call: input.call,
    checker: input.checker,
    program: input.program,
  });

const classesAtExpression = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
}): readonly ts.ClassLikeDeclaration[] => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isClassExpression(current)) return [current];
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, current);
  if (symbol === null) return [];
  const resolved = resolveTypeScriptSymbol(input.checker, symbol);
  if (input.seenSymbols.has(resolved)) return [];
  const next = new Set([...input.seenSymbols, resolved]);
  return (resolved.declarations ?? []).flatMap((declaration) => {
    if (ts.isClassLike(declaration)) return [declaration];
    const initializer = canonicalOwnerDeclarationInitializer(declaration);
    return initializer === null
      ? []
      : classesAtExpression({ ...input, expression: initializer, seenSymbols: next });
  });
};

const constructedClasses = (
  checker: ts.TypeChecker,
  expression: ts.NewExpression,
): readonly ts.ClassLikeDeclaration[] =>
  classesAtExpression({ checker, expression: expression.expression, seenSymbols: new Set() });

const constructorFunctions = (
  checker: ts.TypeChecker,
  expression: ts.NewExpression,
): readonly ExecutableFunction[] =>
  constructedClasses(checker, expression).flatMap((class_) =>
    class_.members.flatMap((member) =>
      ts.isConstructorDeclaration(member) && member.body !== undefined
        ? [member as ExecutableFunction]
        : [],
    ),
  );

const instanceInitializers = (
  checker: ts.TypeChecker,
  expression: ts.NewExpression,
): readonly ts.Expression[] =>
  constructedClasses(checker, expression).flatMap((class_) =>
    class_.members.flatMap((member) => {
      const isStatic = (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;
      return ts.isPropertyDeclaration(member) && !isStatic && member.initializer !== undefined
        ? [member.initializer]
        : [];
    }),
  );

const invocationArguments = (
  node: ts.CallExpression | ts.NewExpression,
): readonly ts.Expression[] => node.arguments ?? [];

const argumentIsDefinitelySupplied = (
  arguments_: readonly ts.Expression[],
  index: number,
): boolean => {
  const argument = arguments_[index];
  if (argument === undefined || arguments_.slice(0, index + 1).some(ts.isSpreadElement)) {
    return false;
  }
  const current = unwrapCanonicalOwnerExpression(argument);
  return !ts.isIdentifier(current) || current.text !== "undefined";
};

const parameterDefaultRoots = (
  invocations: readonly CanonicalOwnerFunctionInvocation[],
): readonly ts.ParameterDeclaration[] =>
  invocations.flatMap((invocation) =>
    invocation.function_.parameters.flatMap((parameter, index) =>
      argumentIsDefinitelySupplied(invocation.arguments, index) ? [] : [parameter],
    ),
  );

const rootsExecutedByNode = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly node: ts.Node;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
}): readonly ts.Node[] => {
  if (ts.isCallExpression(input.node)) {
    return parameterDefaultRoots(directFunctionInvocations({ ...input, call: input.node }));
  }
  if (!ts.isNewExpression(input.node)) return [];
  const expression = input.node;
  const constructors = constructorFunctions(input.checker, expression).map((function_) => ({
    arguments: invocationArguments(expression),
    function_,
  }));
  return [
    ...parameterDefaultRoots(constructors),
    ...instanceInitializers(input.checker, expression),
  ];
};

const getterFunctions = (checker: ts.TypeChecker, node: ts.Node): readonly ExecutableFunction[] => {
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return [];
  const symbol = canonicalOwnerSymbolAtExpression(checker, node);
  return symbol === null
    ? []
    : (resolveTypeScriptSymbol(checker, symbol).declarations ?? []).flatMap((declaration) =>
        ts.isGetAccessorDeclaration(declaration) && declaration.body !== undefined
          ? [declaration as ExecutableFunction]
          : [],
      );
};

const directlyExecutedFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly node: ts.Node;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
}): readonly ExecutableFunction[] => {
  if (ts.isCallExpression(input.node)) return calledFunctions({ ...input, call: input.node });
  if (ts.isNewExpression(input.node)) {
    return [
      ...constructorFunctions(input.checker, input.node),
      ...canonicalOwnerPromiseExecutorFunctions({ ...input, expression: input.node }),
    ];
  }
  return ts.isTaggedTemplateExpression(input.node)
    ? canonicalOwnerAliasedCalledFunctions({
        aliases: input.aliases,
        checker: input.checker,
        expression: input.node.tag,
      }).filter((function_) => function_.asteriskToken === undefined)
    : [];
};

const functionsExecutedByNode = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly node: ts.Node;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
}): readonly ExecutableFunction[] => [
  ...directlyExecutedFunctions(input),
  ...getterFunctions(input.checker, input.node),
  ...canonicalOwnerProtocolFunctions(input),
];

const addCallableAliasesAtNode = (input: {
  readonly aliases: Map<ts.Symbol, Set<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly node: ts.Node;
  readonly program: ts.Program;
}): boolean => {
  if (!ts.isCallExpression(input.node)) return false;
  return directFunctionInvocations({ ...input, call: input.node })
    .filter((invocation) => invocation.function_.asteriskToken === undefined)
    .map((invocation) =>
      addCanonicalOwnerCallableAliases({
        aliases: input.aliases,
        arguments: invocation.arguments,
        checker: input.checker,
        functions: [invocation.function_],
      }),
    )
    .some(Boolean);
};

const appendExecutedBodies = (input: {
  readonly aliases: Map<ts.Symbol, Set<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly functions: Set<ExecutableFunction>;
  readonly nodes: ts.Node[];
  readonly program: ts.Program;
  readonly roots: Set<ts.Node>;
}): boolean => {
  const reachable = input.nodes.filter(canonicalOwnerNodeIsSyntacticallyReachable);
  const aliasesChanged = reachable
    .map((node) => addCallableAliasesAtNode({ ...input, node }))
    .some(Boolean);
  const additions = reachable
    .flatMap((node) => functionsExecutedByNode({ ...input, node }))
    .filter((function_) => !input.functions.has(function_));
  const rootAdditions = reachable
    .flatMap((node) => rootsExecutedByNode({ ...input, node }))
    .filter((root) => !input.roots.has(root));
  additions.forEach((function_) => {
    input.functions.add(function_);
    input.nodes.push(...canonicalOwnerNodesInContext(function_.body));
  });
  rootAdditions.forEach((root) => {
    input.roots.add(root);
    input.nodes.push(...canonicalOwnerNodesInContext(root));
  });
  return aliasesChanged || additions.length > 0 || rootAdditions.length > 0;
};

export const canonicalOwnerReachableNodes = (
  program: ts.Program,
  checker: ts.TypeChecker,
): readonly ts.Node[] => {
  const nodes = program
    .getSourceFiles()
    .filter((source) => !program.isSourceFileDefaultLibrary(source) && !source.isDeclarationFile)
    .flatMap(canonicalOwnerNodesInContext);
  const functions = new Set<ExecutableFunction>();
  const roots = new Set<ts.Node>();
  const aliases = new Map<ts.Symbol, Set<ExecutableFunction>>();
  const complete = (): readonly ts.Node[] =>
    appendExecutedBodies({ aliases, checker, functions, nodes, program, roots })
      ? complete()
      : nodes;
  return complete().filter(canonicalOwnerNodeIsSyntacticallyReachable);
};
