import {
  evaluateCanonicalValueJsonSchemaAssignment,
  evaluateCanonicalValueJsonSchemaCall,
  evaluateCanonicalValueJsonSchemaObject,
  type CanonicalValueJsonSchemaSinkEnvironment,
} from "./canonical-value-json-schema-sink.ts";
import {
  evaluateCanonicalValueEnum,
  evaluateCanonicalValueIndexedAccessType,
  evaluateCanonicalValueLiteralTypeAlias,
  evaluateCanonicalValuePropertyNameType,
  type CanonicalValueTypeSinkEnvironment,
} from "./canonical-value-type-sink.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuePropertyNameDeclaration } from "./canonical-value-type-origin.ts";

export type CanonicalValueStaticSinkEnvironment = CanonicalValueJsonSchemaSinkEnvironment &
  CanonicalValueTypeSinkEnvironment;

export type CanonicalValueStaticSink = {
  readonly evaluate: () => void;
  readonly recordAssignment: (node: ESTree.AssignmentExpression) => void;
  readonly recordCall: (node: ESTree.CallExpression) => void;
  readonly recordIndexedAccess: (node: ESTree.TSIndexedAccessType) => void;
  readonly recordObject: (node: ESTree.ObjectExpression) => void;
  readonly recordPropertyDeclaration: (node: CanonicalValuePropertyNameDeclaration) => void;
  readonly recordPropertyNameType: (node: ESTree.TSTypeOperator) => void;
  readonly recordTypeAlias: (node: ESTree.TSTypeAliasDeclaration) => void;
};

type CanonicalValueStaticSinkState = {
  readonly assignments: ReadonlySet<ESTree.AssignmentExpression>;
  readonly calls: ReadonlySet<ESTree.CallExpression>;
  readonly enums: ReadonlySet<ESTree.TSEnumDeclaration>;
  readonly indexedTypes: ReadonlySet<ESTree.TSIndexedAccessType>;
  readonly objects: ReadonlySet<ESTree.ObjectExpression>;
  readonly propertyNameTypes: ReadonlySet<ESTree.TSTypeOperator>;
  readonly typeAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>;
};

const evaluateCanonicalValueTypeSinks = (
  environment: CanonicalValueStaticSinkEnvironment,
  state: CanonicalValueStaticSinkState,
): void => {
  environment.typeOrigins.indexDeclarations();
  for (const node of state.enums) {
    evaluateCanonicalValueEnum(node, environment);
  }
  for (const node of state.typeAliases) {
    evaluateCanonicalValueLiteralTypeAlias(node, environment);
  }
  for (const node of state.indexedTypes) {
    evaluateCanonicalValueIndexedAccessType(node, environment);
  }
  for (const node of state.propertyNameTypes) {
    evaluateCanonicalValuePropertyNameType(node, environment);
  }
};

const evaluateCanonicalValueJsonSchemaSinks = (
  environment: CanonicalValueStaticSinkEnvironment,
  state: CanonicalValueStaticSinkState,
): void => {
  for (const node of state.objects) {
    evaluateCanonicalValueJsonSchemaObject(node, environment);
  }
  for (const node of state.assignments) {
    evaluateCanonicalValueJsonSchemaAssignment(node, environment);
  }
  for (const node of state.calls) {
    evaluateCanonicalValueJsonSchemaCall(node, environment);
  }
};

export const createCanonicalValueStaticSink = (
  environment: CanonicalValueStaticSinkEnvironment,
): CanonicalValueStaticSink => {
  const assignments = new Set<ESTree.AssignmentExpression>();
  const calls = new Set<ESTree.CallExpression>();
  const enums = new Set<ESTree.TSEnumDeclaration>();
  const indexedTypes = new Set<ESTree.TSIndexedAccessType>();
  const objects = new Set<ESTree.ObjectExpression>();
  const propertyNameTypes = new Set<ESTree.TSTypeOperator>();
  const typeAliases = new Set<ESTree.TSTypeAliasDeclaration>();
  return {
    evaluate: () => {
      const state = {
        assignments,
        calls,
        enums,
        indexedTypes,
        objects,
        propertyNameTypes,
        typeAliases,
      };
      evaluateCanonicalValueTypeSinks(environment, state);
      evaluateCanonicalValueJsonSchemaSinks(environment, state);
    },
    recordAssignment: (node) => {
      assignments.add(node);
    },
    recordCall: (node) => {
      calls.add(node);
    },
    recordIndexedAccess: (node) => {
      indexedTypes.add(node);
    },
    recordObject: (node) => {
      objects.add(node);
    },
    recordPropertyDeclaration: (node) => {
      environment.typeOrigins.recordPropertyDeclaration(node);
      if (node.type === "TSEnumDeclaration") enums.add(node);
    },
    recordPropertyNameType: (node) => {
      propertyNameTypes.add(node);
    },
    recordTypeAlias: (node) => {
      environment.typeOrigins.recordTypeAlias(node);
      typeAliases.add(node);
    },
  };
};
