import type { Definition, ESTree, Scope, Variable } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";

export type CanonicalValueIdentifier =
  | ESTree.BindingIdentifier
  | ESTree.IdentifierName
  | ESTree.IdentifierReference;

export type CanonicalValueClassNode = ESTree.Class;

export type CanonicalValueFunctionExpression = ESTree.Function & {
  readonly body: ESTree.FunctionBody;
  readonly type: "FunctionExpression";
};

export type CanonicalValuePropertyDefinition = ESTree.PropertyDefinition;

export type CanonicalValueExecutionNode =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | CanonicalValuePropertyDefinition
  | ESTree.Program
  | ESTree.StaticBlock;

export type CanonicalValueExecutionOccurrence = ESTree.Node;

export type CanonicalValueExecutionContext = {
  readonly node: CanonicalValueExecutionNode;
  readonly scope: Scope;
};

export type CanonicalValuePropertyKey =
  | { readonly kind: "computed"; readonly expression: ESTree.Node }
  | { readonly kind: "static"; readonly value: string };

export type CanonicalValueIndexedPropertyPath = readonly CanonicalValuePropertyKey[];

export type CanonicalValueCallArgumentSegment =
  | { readonly expression: ESTree.Expression; readonly kind: "array" }
  | { readonly elements: readonly ESTree.Argument[]; readonly kind: "direct" }
  | {
      readonly expression: ESTree.Expression;
      readonly kind: "source";
      readonly sourcePath: CanonicalValueSourcePath;
    }
  | { readonly kind: "unknown"; readonly width?: number };

export type CanonicalValueCallArgumentOccurrence = {
  readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
  readonly invocation: CanonicalValueExecutionOccurrence;
};

export type CanonicalValueYieldResult = {
  readonly delegate: boolean;
  readonly expression: ESTree.Expression;
};

export type CanonicalValueCollectionCallbackResult = {
  readonly functionNode: ESTree.ArrowFunctionExpression | ESTree.Function;
  readonly returnExpressions: readonly ESTree.Expression[];
};

export type CanonicalValueSourcePathSegment =
  | { readonly kind: "array-element" }
  | { readonly kind: "array-index"; readonly index: number }
  | { readonly kind: "array-rest"; readonly startIndex: number }
  | {
      readonly kind: "call-rest";
      readonly segments: readonly CanonicalValueCallArgumentSegment[];
      readonly startIndex: number;
    }
  | { readonly kind: "unknown" }
  | { readonly kind: "property-name" }
  | { readonly kind: "static-values"; readonly values: readonly CanonicalValue[] }
  | { readonly expression: ESTree.Expression; readonly kind: "default" }
  | {
      readonly excludedKeys: readonly CanonicalValuePropertyKey[];
      readonly kind: "object-rest";
    }
  | { readonly key: CanonicalValuePropertyKey; readonly kind: "property" };

export type CanonicalValueSourcePath = readonly CanonicalValueSourcePathSegment[];

export type CanonicalValueGuard =
  | {
      readonly kind: "condition";
      readonly outcome: "falsy" | "non-nullish" | "nullish" | "truthy";
      readonly test: ESTree.Expression;
    }
  | {
      readonly discriminant: ESTree.Expression;
      readonly kind: "switch-case";
      readonly node: ESTree.SwitchCase;
      readonly test: ESTree.Expression | null;
    }
  | {
      readonly kind: "iteration";
      readonly operator: "in" | "of";
      readonly source: ESTree.Expression;
    }
  | { readonly kind: "catch"; readonly node: ESTree.CatchClause };

export type CanonicalValueWriteOperator =
  | "declaration"
  | "delete"
  | "for-in"
  | "for-of"
  | "parameter"
  | "parameter-default"
  | "update"
  | ESTree.AssignmentOperator;

export type CanonicalValueWriteBase = {
  readonly executionContext: CanonicalValueExecutionContext;
  readonly expression: ESTree.Expression;
  readonly guards: readonly CanonicalValueGuard[];
  readonly invocation: CanonicalValueExecutionOccurrence | null;
  readonly iteration: ESTree.ForInStatement | ESTree.ForOfStatement | null;
  readonly operator: CanonicalValueWriteOperator;
  readonly sourceContext: {
    readonly cutoff: number;
    readonly executionContext: CanonicalValueExecutionContext;
  };
  readonly sourcePath: CanonicalValueSourcePath;
  readonly start: number;
};

export const canonicalValueWriteSuppliesValue = (write: CanonicalValueWriteBase): boolean =>
  write.operator === "=" ||
  write.operator === "declaration" ||
  write.operator === "for-in" ||
  write.operator === "for-of" ||
  write.operator === "parameter" ||
  write.operator === "parameter-default";

export type CanonicalValueBindingWrite = CanonicalValueWriteBase & {
  readonly binding: Variable;
  readonly target: CanonicalValueIdentifier;
};

export type CanonicalValueMemberWrite = CanonicalValueWriteBase & {
  readonly binding: Variable;
  readonly target: ESTree.MemberExpression;
  readonly targetPath: CanonicalValueIndexedPropertyPath;
};

export type CanonicalValueWriteQuery = {
  readonly before?: number;
  readonly executionContext?: CanonicalValueExecutionContext;
};

export type CanonicalValueWriteOccurrence = {
  readonly callSites: readonly CanonicalValueExecutionOccurrence[];
  readonly kind: "called-context" | "parent-context" | "same-context";
  readonly start: number;
};

export type CanonicalValueGlobalWrite = CanonicalValueWriteBase & {
  readonly runtimePath: readonly (string | null)[];
};

export type CanonicalValueOccurrenceQuery = {
  readonly cutoff: number;
  readonly executionContext: CanonicalValueExecutionContext;
};

export type CanonicalValueBindingIndex = {
  readonly allBindings: () => readonly Variable[];
  readonly callArgumentOccurrencesOf: (
    identifier: ESTree.IdentifierReference,
  ) => readonly CanonicalValueCallArgumentOccurrence[];
  readonly bindingWritesOf: (
    binding: Variable,
    query?: CanonicalValueWriteQuery,
  ) => readonly CanonicalValueBindingWrite[];
  readonly callReturnResults: (
    node: ESTree.CallExpression | ESTree.NewExpression,
  ) => readonly ESTree.Expression[];
  readonly callYieldResults: (
    node: ESTree.CallExpression | ESTree.NewExpression,
  ) => readonly CanonicalValueYieldResult[];
  readonly collectionCallbackReturnResults: (
    node: ESTree.CallExpression,
  ) => readonly ESTree.Expression[];
  readonly collectionCallbackResults: (
    node: ESTree.CallExpression,
  ) => readonly CanonicalValueCollectionCallbackResult[];
  readonly definitionsOf: (binding: Variable) => readonly Definition[];
  readonly executionContextAt: (node: ESTree.Node) => CanonicalValueExecutionContext;
  readonly executionOccurrencesOf: (
    node: ESTree.Expression,
    query: CanonicalValueOccurrenceQuery,
  ) => readonly CanonicalValueWriteOccurrence[];
  readonly finalize: () => void;
  readonly guardsAt: (node: ESTree.Node) => readonly CanonicalValueGuard[];
  readonly globalWrites: () => readonly CanonicalValueGlobalWrite[];
  readonly iterableYieldResults: (node: ESTree.Expression) => readonly CanonicalValueYieldResult[];
  readonly memberWritesOf: (
    binding: Variable,
    query?: CanonicalValueWriteQuery,
  ) => readonly CanonicalValueMemberWrite[];
  readonly memberReadResults: (node: ESTree.MemberExpression) => {
    readonly complete: boolean;
    readonly expressions: readonly ESTree.Expression[];
  } | null;
  readonly recordAssignment: (node: ESTree.AssignmentExpression) => void;
  readonly recordAssignmentPattern: (node: ESTree.AssignmentPattern) => void;
  readonly recordBinaryExpression: (node: ESTree.BinaryExpression) => void;
  readonly recordCallExpression: (node: ESTree.CallExpression) => void;
  readonly recordClassDeclaration: (node: ESTree.Class) => void;
  readonly recordClassExpression: (node: ESTree.Class) => void;
  readonly recordDecorator: (node: ESTree.Decorator) => void;
  readonly recordExportDefaultDeclaration: (node: ESTree.ExportDefaultDeclaration) => void;
  readonly recordExportNamedDeclaration: (node: ESTree.ExportNamedDeclaration) => void;
  readonly recordForInStatement: (node: ESTree.ForInStatement) => void;
  readonly recordForOfStatement: (node: ESTree.ForOfStatement) => void;
  readonly recordMemberExpression: (node: ESTree.MemberExpression) => void;
  readonly recordNewExpression: (node: ESTree.NewExpression) => void;
  readonly recordReturnStatement: (node: ESTree.ReturnStatement) => void;
  readonly recordSpreadElement: (node: ESTree.SpreadElement) => void;
  readonly recordTaggedTemplateExpression: (node: ESTree.TaggedTemplateExpression) => void;
  readonly recordTemplateLiteral: (node: ESTree.TemplateLiteral) => void;
  readonly recordUnaryExpression: (node: ESTree.UnaryExpression) => void;
  readonly recordUpdateExpression: (node: ESTree.UpdateExpression) => void;
  readonly recordVariableDeclarator: (node: ESTree.VariableDeclarator) => void;
  readonly recordYieldExpression: (node: ESTree.YieldExpression) => void;
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
  readonly writeOccurrencesOf: (
    write: CanonicalValueWriteBase,
    query: CanonicalValueOccurrenceQuery,
  ) => readonly CanonicalValueWriteOccurrence[];
};
