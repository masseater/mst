import { propertyKeyName, unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { bindingInScope } from "./scope-resolution.ts";

import type { ESTree } from "@oxlint/plugins";
import type { ModuleLoaderInvocation } from "./canonical-value-module-loader-fact.ts";
import type { CanonicalValueModuleResolution } from "./canonical-value-module-resolution.ts";

export const canonicalValueModuleMemberName = (member: ESTree.MemberExpression): string | null =>
  member.property.type === "PrivateIdentifier" ? null : propertyKeyName(member.property);

const argumentExpression = (argument: ESTree.Argument | undefined): ESTree.Expression | null =>
  argument === undefined ? null : argument.type === "SpreadElement" ? argument.argument : argument;

const reflectApplyInvocation = (
  resolution: CanonicalValueModuleResolution,
  call: ESTree.CallExpression,
): ModuleLoaderInvocation | null => {
  const callee = unwrapExpression(call.callee);
  if (
    callee.type !== "MemberExpression" ||
    callee.object.type !== "Identifier" ||
    callee.object.name !== "Reflect" ||
    canonicalValueModuleMemberName(callee) !== "apply"
  ) {
    return null;
  }
  const binding = bindingInScope(
    resolution.context.sourceCode.getScope(callee.object),
    callee.object.name,
  );
  if (binding !== null && binding.defs.length !== 0) return null;
  const target = argumentExpression(call.arguments[0]);
  return target === null
    ? null
    : {
        argumentArray: argumentExpression(call.arguments[2]),
        bind: false,
        directArguments: null,
        target,
      };
};

const memberInvocation = (
  call: ESTree.CallExpression,
  callee: ESTree.MemberExpression & { readonly object: ESTree.Expression },
): ModuleLoaderInvocation => {
  const name = canonicalValueModuleMemberName(callee);
  if (name === "call") {
    return {
      argumentArray: null,
      bind: false,
      directArguments: call.arguments.slice(1),
      target: callee.object,
    };
  }
  if (name === "apply") {
    return {
      argumentArray: argumentExpression(call.arguments[1]),
      bind: false,
      directArguments: null,
      target: callee.object,
    };
  }
  return {
    argumentArray: null,
    bind: name === "bind",
    directArguments: name === "bind" ? call.arguments.slice(1) : call.arguments,
    target: name === "bind" ? callee.object : callee,
  };
};

export const canonicalValueNormalizedModuleInvocation = (
  resolution: CanonicalValueModuleResolution,
  call: ESTree.CallExpression,
): ModuleLoaderInvocation => {
  const reflected = reflectApplyInvocation(resolution, call);
  if (reflected !== null) return reflected;
  const callee = unwrapExpression(call.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") {
    return {
      argumentArray: null,
      bind: false,
      directArguments: call.arguments,
      target: callee,
    };
  }
  return memberInvocation(call, callee);
};
