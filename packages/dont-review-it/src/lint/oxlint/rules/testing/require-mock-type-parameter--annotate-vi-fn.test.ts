import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireMockTypeParameter } from "./require-mock-type-parameter--annotate-vi-fn.ts";

const IMPORTED_NAMESPACE = 'import { vi } from "vitest";';

const RENAMED_NAMESPACE = 'import { vi as mocker } from "vitest";';

const SPELLED_NAMESPACE = 'import { "vi" as mocker } from "vitest";';

const WHOLE_MODULE = 'import * as vitest from "vitest";';

const OPEN_TYPE = ["an", "y"].join("");

const OPEN_LIST = `${OPEN_TYPE}[]`;

describe("dont-review-it/require-mock-type-parameter--annotate-vi-fn", () => {
  testLintRule(requireMockTypeParameter, {
    valid: [
      {
        name: "a creation carrying the call signature of the dependency is typed",
        documented: true,
        code: "const send = vi.fn<(recipient: string) => Promise<void>>();",
      },
      {
        name: "behaviour set up after a typed creation keeps the type parameter of the creation",
        code: "const send = vi.fn<(recipient: string) => void>().mockReturnValue(undefined);",
      },
      {
        name: "two levels of behaviour setup after a typed creation stay outside the rule",
        code: "const send = vi.fn<(recipient: string) => void>().mockName('send').mockClear();",
      },
      {
        name: "spying on an existing function derives the signature from the real member",
        documented: true,
        code: "const send = vi.spyOn(mailer, 'send');",
      },
      {
        name: "promoting an existing function derives the signature from the real binding",
        code: "const send = vi.mocked(mailer.send);",
      },
      {
        name: "a member named after the factory on an unrelated object is not a mock creation",
        code: "const registry = { fn: () => 0 };\nconst held = registry.fn();",
      },
      {
        name: "a factory member chosen at run time is left to the rule that reads written names",
        code: "const send = vi[chosen]();",
      },
      {
        name: "a call naming no receiver reaches no mock namespace",
        code: "const send = createSender();",
      },
      {
        name: "a namespace taken apart by destructuring is not followed to the mock namespace",
        code: "const { mocker } = library;\nconst send = mocker.fn();",
      },
      {
        name: "an import renaming another export to the namespace spelling is not the namespace",
        code: 'import { expect as vi } from "vitest";\nconst send = vi.fn();',
      },
      {
        name: "a parameter spelled like the namespace is not the mock namespace",
        code: "const build = (vi) => vi.fn();",
      },
      {
        name: "bindings that stand on each other are followed once and then given up on",
        code: "let first = second;\nlet second = first;\nconst send = first.fn();",
      },
      {
        name: "a binding declared without an initializer resolves to no namespace",
        code: "let solo;\nconst send = solo.fn();",
      },
      {
        name: "a namespace spelling reached through two members is not a module namespace",
        code: "const send = outer.inner.vi.fn();",
      },
      {
        name: "another member of a module namespace is not the mock namespace",
        code: `${WHOLE_MODULE}\nconst send = vitest.other.fn();`,
      },
      {
        name: "a member of a module namespace chosen at run time spells no namespace",
        code: `${WHOLE_MODULE}\nconst send = vitest[chosen].fn();`,
      },
      {
        name: "a namespace spelling held by a plain object is not a module namespace",
        code: "const plain = {};\nconst send = plain.vi.fn();",
      },
      {
        name: "a namespace spelling held by an undeclared name resolves to no binding",
        code: "const send = unknownNs.vi.fn();",
      },
      {
        name: "a signature returning unknown forces the caller to narrow before use",
        code: "const send = vi.fn<(recipient: string) => unknown>();",
      },
      {
        name: "a signature taking no argument pins the empty argument list",
        code: "const send = vi.fn<() => void>();",
      },
      {
        name: "a rest parameter behind a named parameter still pins the leading argument",
        code: `const send = vi.fn<(recipient: string, ...rest: ${OPEN_LIST}) => void>();`,
      },
      {
        name: "a rest parameter typed as a tuple pins every argument position",
        code: "const send = vi.fn<(...rest: [string, number]) => void>();",
      },
      {
        name: "a rest parameter typed as a list of one type pins what each argument is",
        code: "const send = vi.fn<(...rest: string[]) => void>();",
      },
      {
        name: "a signature named by a qualified type is read as a pinned signature",
        code: "const send = vi.fn<Mocks.Sender>();",
      },
      {
        name: "a signature named by an imported type is read as a pinned signature",
        code: "const send = vi.fn<Sender>();",
      },
      {
        name: "the configured namespace spelling replaces the built in one",
        code: "const send = vi.fn();",
        options: [{ mockNamespaceSpellings: ["mocker"] }],
      },
    ],
    invalid: [
      {
        name: "a creation without a type parameter is reported",
        documented: true,
        code: "const send = vi.fn();",
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a creation handed an implementation is reported the same way",
        code: "const send = vi.fn(() => undefined);",
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "behaviour set up after an untyped creation is reported at the creation",
        code: "const send = vi.fn().mockReturnValue(undefined);",
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a factory member written as a string subscript is the same creation",
        code: 'const send = vi["fn"]();',
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a factory member written as a template subscript is the same creation",
        code: "const send = vi[`fn`]();",
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "an imported namespace is the same namespace as the injected one",
        code: `${IMPORTED_NAMESPACE}\nconst send = vi.fn();`,
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a namespace renamed on import is the same namespace",
        code: `${RENAMED_NAMESPACE}\nconst send = mocker.fn();`,
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a namespace imported under a quoted export name is the same namespace",
        code: `${SPELLED_NAMESPACE}\nconst send = mocker.fn();`,
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a namespace reached through a whole module import is the same namespace",
        code: `${WHOLE_MODULE}\nconst send = vitest.vi.fn();`,
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a namespace passed along a chain of bindings is followed to the import",
        code: `${IMPORTED_NAMESPACE}\nconst mocker = vi;\nconst shorthand = mocker;\nconst send = shorthand.fn();`,
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a type parameter left open pins nothing",
        code: `const send = vi.fn<${OPEN_TYPE}>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a type parameter naming the catch all callable type pins nothing",
        documented: true,
        code: "const send = vi.fn<Function>();",
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a signature leaving the returned value open leaves it unchecked",
        code: `const send = vi.fn<(recipient: string) => ${OPEN_TYPE}>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a lone rest parameter typed as an open list takes every argument list",
        code: `const send = vi.fn<(...args: ${OPEN_LIST}) => void>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a lone rest parameter typed as a list of unknown takes every argument list",
        code: "const send = vi.fn<(...args: unknown[]) => void>();",
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a lone rest parameter typed as a readonly open list takes every argument list",
        code: `const send = vi.fn<(...args: readonly ${OPEN_LIST}) => void>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a lone rest parameter left open takes every argument list",
        code: `const send = vi.fn<(...args: ${OPEN_TYPE}) => void>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a lone rest parameter left without a type takes every argument list",
        code: "const send = vi.fn<(...args) => void>();",
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "parentheses around a signature that pins nothing change nothing",
        code: `const send = vi.fn<((...args: ${OPEN_LIST}) => ${OPEN_TYPE})>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "the second of two type parameters is read the same way as the first",
        code: `const send = vi.fn<[string], ${OPEN_TYPE}>();`,
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a configured open type name is read as pinning nothing",
        code: "const send = vi.fn<AnyFn>();",
        options: [{ unconstrainedTypeNames: ["AnyFn"] }],
        errors: [{ messageId: "unconstrainedMockTypeParameter" }],
      },
      {
        name: "a configured factory member is a creation of the same kind",
        code: "const send = vi.createMock();",
        options: [{ mockFactoryMembers: ["createMock"] }],
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a configured namespace spelling carries the same creation",
        code: "const send = mocker.fn();",
        options: [{ mockNamespaceSpellings: ["mocker"] }],
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "a settings object naming none of the lists falls back to the built in names",
        code: "const send = vi.fn();",
        options: [{}],
        errors: [{ messageId: "untypedMockCreation" }],
      },
      {
        name: "an option holding an empty list falls back to the built in names",
        code: "const send = vi.fn();",
        options: [{ mockNamespaceSpellings: [] }],
        errors: [{ messageId: "untypedMockCreation" }],
      },
    ],
  });
});
