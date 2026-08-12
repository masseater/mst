import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { STRICT_RULE, STRICT_SOURCE } from "./canonical-literal-rule-test-fixture.ts";
import { withOwner } from "./canonical-value-rule-test-fixture.ts";

const error = { messageId: "canonicalValueLiteral" } as const;
const domainError = { messageId: "localFiniteValueSetWithoutOwner" } as const;

describe("canonical value static standard expressions", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "a replaced Number formatter is not a static producer",
        code: 'Number.prototype.toFixed = () => "runtime"; consume((1).toFixed());',
        filename: STRICT_SOURCE,
      },
      {
        name: "a replaced RegExp source getter is not a static producer",
        code: 'Object.defineProperty(RegExp.prototype, "source", { get: () => runtimeValue() }); consume(/draft/u.source);',
        filename: STRICT_SOURCE,
      },
      {
        name: "a shadowed JSON object is not a static producer",
        code: "const JSON = { stringify: () => runtimeValue() }; consume(JSON.stringify(1));",
        filename: STRICT_SOURCE,
      },
      {
        name: "an own hasOwnProperty method is not the standard predicate",
        code: 'consume(({ hasOwnProperty: () => runtimeValue(), x: 0 }).hasOwnProperty("x"));',
        filename: STRICT_SOURCE,
      },
      {
        name: "a custom object prototype is not treated as Object prototype",
        code: 'consume(({ __proto__: { hasOwnProperty: () => runtimeValue() }, x: 0 }).hasOwnProperty("x"));',
        filename: STRICT_SOURCE,
      },
      {
        name: "a replaced Object prototype predicate is not a static producer",
        code: 'Object.prototype.hasOwnProperty = () => false; consume(({ x: 0 }).hasOwnProperty("x"));',
        filename: STRICT_SOURCE,
      },
    ],
    invalid: [
      {
        name: "static arithmetic produces a canonical number",
        code: "consume(6 / 2);",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a Number conversion produces a canonical number",
        code: 'consume(Number("3"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a Math conversion produces a canonical number",
        code: "consume(Math.floor(3.9));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Math ceil produces a canonical number",
        code: "consume(Math.ceil(2.1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Math round produces a canonical number",
        code: "consume(Math.round(2.6));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Math trunc produces a canonical number",
        code: "consume(Math.trunc(3.9));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Math abs produces a canonical number",
        code: "consume(Math.abs(-3));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Math sign produces a canonical number",
        code: "consume(Math.sign(-2));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "parseInt produces a canonical number",
        code: 'consume(parseInt("3px", 10));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number parseInt produces a canonical number",
        code: 'consume(Number.parseInt("3px", 10));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "parseFloat produces a canonical number",
        code: 'consume(parseFloat("3e0"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number parseFloat produces a canonical number",
        code: 'consume(Number.parseFloat("3e0"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "JSON stringify produces a canonical spelling",
        code: "consume(JSON.stringify(1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number isFinite produces a canonical boolean",
        code: "consume(Number.isFinite(1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number isInteger produces a canonical boolean",
        code: "consume(Number.isInteger(1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number isNaN produces a canonical boolean",
        code: "consume(Number.isNaN(NaN));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number isSafeInteger produces a canonical boolean",
        code: "consume(Number.isSafeInteger(1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "global isFinite produces a canonical boolean",
        code: "consume(isFinite(1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "global isNaN produces a canonical boolean",
        code: 'consume(isNaN("x"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String search produces a canonical number",
        code: 'consume("aaax".search(/x/));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String charCodeAt produces a canonical number",
        code: 'consume("\\u0003".charCodeAt(0));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String codePointAt produces a canonical number",
        code: 'consume("\\u0003".codePointAt(0));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Object hasOwn produces a canonical boolean",
        code: 'consume(Object.hasOwn({ x: 1 }, "x"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Reflect has produces a canonical boolean",
        code: 'consume(Reflect.has({ x: 1 }, "x"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Object isExtensible produces a canonical boolean",
        code: "consume(Object.isExtensible({}));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Object isFrozen produces a canonical boolean",
        code: "consume(Object.isFrozen(Object.freeze({})));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Object isSealed produces a canonical boolean",
        code: "consume(Object.isSealed(Object.seal({})));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Reflect isExtensible produces a canonical boolean",
        code: "consume(Reflect.isExtensible({}));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "ArrayBuffer isView produces a canonical boolean",
        code: "consume(ArrayBuffer.isView(new Uint8Array()));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "hasOwnProperty produces a canonical boolean",
        code: 'consume(({ x: 0 }).hasOwnProperty("x"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "propertyIsEnumerable produces a canonical boolean",
        code: 'consume(({ x: 0 }).propertyIsEnumerable("x"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a derived primitive binding reports its producer once",
        code: 'const retry = "abc".length; consume(retry);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a destructured derived primitive reports at its use",
        code: 'const { length: retry } = "abc"; consume(retry);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a RegExp source getter produces its canonical spelling",
        code: "consume(/draft/u.source);",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a RegExp alias preserves its source spelling",
        code: "const pattern = /draft/u; consume(pattern.source);",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a primitive toString call produces its canonical spelling once",
        code: "consume((-1).toString());",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a boolean toString call produces its canonical spelling once",
        code: "consume(true.toString());",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a named function exposes its canonical name",
        code: "consume((function draft() {}).name);",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a named class exposes its canonical name",
        code: "consume((class draft {}).name);",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number toFixed produces a canonical spelling",
        code: "consume((1).toFixed());",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number toPrecision produces a canonical spelling",
        code: "consume((1).toPrecision(1));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Number toExponential produces a canonical spelling",
        code: "consume((1).toExponential(0));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a formatter write after the call does not change the earlier result",
        code: 'consume((1).toFixed()); Number.prototype.toFixed = () => "runtime";',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "an uncalled formatter write does not change the result",
        code: 'function replace() { Number.prototype.toFixed = () => "runtime"; } consume((1).toFixed());',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "a statically unreachable getter replacement does not change the result",
        code: 'if (false) Object.defineProperty(RegExp.prototype, "source", { get: () => runtimeValue() }); consume(/draft/u.source);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
    ],
  });
});

describe("canonical value static standard domains", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "an extensibility flag is not a vocabulary",
        code: "z.enum([Object.isExtensible({}), Object.isExtensible(Object.preventExtensions({}))]);",
      },
      {
        name: "an own-property flag is not a vocabulary",
        code: 'z.enum([({ x: 0 }).hasOwnProperty("x"), ({}).hasOwnProperty("x")]);',
      },
      {
        name: "a shadowed JSON producer stays unknown",
        code: "const JSON = { stringify: runtimeValue }; z.enum([JSON.stringify(1), JSON.stringify(2)]);",
      },
    ],
    invalid: [
      {
        name: "JSON stringify results define a vocabulary",
        code: "z.enum([JSON.stringify(1), JSON.stringify(2)]);",
        errors: [domainError],
      },
      {
        name: "Math results define a vocabulary",
        code: "z.enum([Math.floor(2.9), Math.floor(3.9)]);",
        errors: [domainError],
      },
      {
        name: "parseInt results define a vocabulary",
        code: 'z.enum([parseInt("2px", 10), parseInt("3px", 10)]);',
        errors: [domainError],
      },
      {
        name: "parseFloat results define a vocabulary",
        code: 'z.enum([parseFloat("2e0"), parseFloat("3e0")]);',
        errors: [domainError],
      },
      {
        name: "String fromCharCode results define a vocabulary",
        code: "z.enum([String.fromCharCode(97), String.fromCharCode(98)]);",
        errors: [domainError],
      },
      {
        name: "String fromCodePoint results define a vocabulary",
        code: "z.enum([String.fromCodePoint(97), String.fromCodePoint(98)]);",
        errors: [domainError],
      },
      {
        name: "String search results define a vocabulary",
        code: 'z.enum(["aax".search(/x/), "aaax".search(/x/)]);',
        errors: [domainError],
      },
      {
        name: "String charCodeAt results define a vocabulary",
        code: 'z.enum(["\\u0002".charCodeAt(0), "\\u0003".charCodeAt(0)]);',
        errors: [domainError],
      },
      {
        name: "String codePointAt results define a vocabulary",
        code: 'z.enum(["\\u0002".codePointAt(0), "\\u0003".codePointAt(0)]);',
        errors: [domainError],
      },
      {
        name: "encoded URI components define a vocabulary",
        code: 'z.enum([encodeURIComponent("a b"), encodeURIComponent("c d")]);',
        errors: [domainError],
      },
      {
        name: "Number formatter results define a vocabulary",
        code: "z.enum([(1).toExponential(0), (2).toExponential(0)]);",
        errors: [domainError],
      },
    ],
  });
});
