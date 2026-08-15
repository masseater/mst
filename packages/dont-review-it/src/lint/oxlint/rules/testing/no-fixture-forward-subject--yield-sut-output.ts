import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  fixtureContextParameterName,
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
} from "../../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { staticCalleeName } from "../../lib/spec-syntax/static-names.ts";
import {
  asSpecFunction,
  blockBodyOf,
  localConstInitializer,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "../../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const HANDLER_SCOPING_WRAPPERS_OPTION = "handlerScopingWrappers";

const DEFAULT_HANDLER_SCOPING_WRAPPERS: readonly string[] = [];

const handlerScopingWrappersFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return new Set(DEFAULT_HANDLER_SCOPING_WRAPPERS);
  }

  const configured = first[HANDLER_SCOPING_WRAPPERS_OPTION];
  if (!Array.isArray(configured)) return new Set(DEFAULT_HANDLER_SCOPING_WRAPPERS);
  return new Set(
    configured.filter((candidate): candidate is string => typeof candidate === "string"),
  );
};

const handedNamesOf = (factory: SpecFunction): ReadonlySet<string> => {
  const contextName = fixtureContextParameterName(factory);
  if (contextName !== null) return new Set([contextName]);

  const dependencies = fixtureDependenciesOf(factory) ?? [];
  return new Set(dependencies.flatMap(({ boundAs }) => (boundAs === null ? [] : [boundAs])));
};

const scopedCallbackOf = (
  call: ESTree.CallExpression,
  wrappings: ReadonlySet<string>,
): SpecFunction | null => {
  const spelling = staticCalleeName(call);
  if (spelling === null || !wrappings.has(spelling)) return null;

  const handed = call.arguments.at(-1);
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return asSpecFunction(handed);
};

type HandedBack = {
  readonly at: ESTree.Expression;
  readonly bodies: readonly ESTree.FunctionBody[];
};

const handedBackValues = (
  given: HandedBack & { readonly wrappers: ReadonlySet<string> },
): readonly HandedBack[] => {
  const { at, bodies, wrappers: wrappings } = given;
  const written = unwrapSubject(at);
  if (written.type !== "CallExpression") return [{ at, bodies }];

  const scoped = scopedCallbackOf(written, wrappings);
  if (scoped === null) return [{ at, bodies }];

  const inner = blockBodyOf(scoped);
  const reached = inner === null ? bodies : [...bodies, inner];
  return returnedExpressionsOf(scoped).flatMap((handed) =>
    handedBackValues({ at: handed, bodies: reached, wrappers: wrappings }),
  );
};

const resolvedThrough = (
  handedBack: HandedBack,
  reached: ReadonlySet<string>,
): ESTree.Expression => {
  const { at, bodies } = handedBack;
  const written = unwrapSubject(at);
  if (written.type !== "Identifier" || reached.has(written.name)) return written;

  const bound = bodies.flatMap((writtenBody) => {
    const init = localConstInitializer(writtenBody, written.name);
    return init === null ? [] : [init];
  });

  const innermost = bound.at(-1);
  if (innermost === undefined) return written;
  return resolvedThrough({ at: innermost, bodies }, new Set([...reached, written.name]));
};

const rootOf = (at: ESTree.Expression): ESTree.Expression => {
  const written = unwrapSubject(at);
  return written.type === "MemberExpression" ? rootOf(written.object) : written;
};

const isHandedOver = (at: ESTree.Expression, handed: ReadonlySet<string>): boolean => {
  const root = rootOf(at);
  return root.type === "Identifier" && handed.has(root.name);
};

const handedArgumentsOf = (
  call: ESTree.CallExpression,
  handed: ReadonlySet<string>,
): readonly ESTree.Expression[] =>
  call.arguments
    .map((argument) => (argument.type === "SpreadElement" ? argument.argument : argument))
    .filter((argument) => isHandedOver(argument, handed));

const spreadArgumentsOf = (written: ESTree.Expression): readonly ESTree.Expression[] => {
  if (written.type === "ObjectExpression") {
    return written.properties.flatMap((property) =>
      property.type === "SpreadElement" ? [property.argument] : [],
    );
  }
  if (written.type !== "ArrayExpression") return [];
  return written.elements.flatMap((held) =>
    held?.type === "SpreadElement" ? [held.argument] : [],
  );
};

type SubjectReading = {
  readonly at: ESTree.Expression;
  readonly written: ESTree.Expression;
  readonly handed: ReadonlySet<string>;
};

type ForwardedSubject = {
  readonly at: ESTree.Expression;
  readonly messageId: string;
  readonly root: ESTree.Expression;
};

const carriedForwardingOf = ({ at, written, handed }: SubjectReading): ForwardedSubject | null => {
  if (written.type === "CallExpression") {
    const [carried] = handedArgumentsOf(written, handed);
    if (carried === undefined) return null;
    return { at, messageId: "derivedSubject", root: rootOf(carried) };
  }

  const [spread] = spreadArgumentsOf(written).filter((argument) => isHandedOver(argument, handed));
  if (spread === undefined) return null;
  return { at, messageId: "spreadSubject", root: rootOf(spread) };
};

const forwardingOf = (reading: SubjectReading): ForwardedSubject | null => {
  const { at, written, handed } = reading;
  if (written.type === "Identifier") {
    return handed.has(written.name) ? { at, messageId: "forwardedSubject", root: written } : null;
  }
  if (written.type === "MemberExpression") {
    return { at, messageId: "projectedSubject", root: rootOf(written) };
  }
  return carriedForwardingOf(reading);
};

const forwardingsFor = (given: {
  readonly handedBack: HandedBack;
  readonly handed: ReadonlySet<string>;
}): readonly ForwardedSubject[] => {
  const { handedBack, handed } = given;
  const written = resolvedThrough(handedBack, new Set());
  const forwarding = forwardingOf({ at: handedBack.at, written, handed });
  return forwarding === null ? [] : [forwarding];
};

const declaredForwardings = (given: {
  readonly factory: SpecFunction;
  readonly subjects: readonly ESTree.Expression[];
  readonly wrappers: ReadonlySet<string>;
}): readonly ForwardedSubject[] => {
  const { factory, subjects, wrappers: wrappings } = given;
  const handed = handedNamesOf(factory);
  const writtenBody = blockBodyOf(factory);
  const writtenBodies = writtenBody === null ? [] : [writtenBody];

  return subjects.flatMap((subject) =>
    handedBackValues({ at: subject, bodies: writtenBodies, wrappers: wrappings }).flatMap(
      (handedBack) => forwardingsFor({ handedBack, handed }),
    ),
  );
};

const forwardedSubjectsIn = (given: {
  readonly call: ESTree.CallExpression;
  readonly wrappers: ReadonlySet<string>;
}): readonly ForwardedSubject[] =>
  fixtureDeclarationsOf(given.call).flatMap(({ factory, subjects }) =>
    factory === null ? [] : declaredForwardings({ factory, subjects, wrappers: given.wrappers }),
  );

export const noFixtureForwardSubject = createDontReviewItRule({
  name: "no-fixture-forward-subject--yield-sut-output",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a fixture handing back a binding it was given, a member read off an existing value, or a value derived from a binding it was given, so the subject a fixture owns is the whole output of the code it exercises rather than a narrower view of something that already existed",
      relatedGuidelines: [],
    },
    messages: {
      forwardedSubject:
        "A fixture must not hand back a binding it was given. `{{subject}}` arrives through the fixture context and leaves this fixture unchanged. Return the output of the code this fixture exercises, and take `{{subject}}` apart in the assertion that needs it.",
      projectedSubject:
        "A fixture must not hand back a member read off an existing value. `{{subject}}` is the whole value that member comes from. Return `{{subject}}` itself, rename this fixture and the test parameter after the whole value, and read the member in the assertion.",
      derivedSubject:
        "A fixture must not hand back the value of a call built out of a binding it was given. `{{subject}}` is passed into that call. Move the call into the fixture that owns `{{subject}}`, and return the output of the code this fixture exercises.",
      spreadSubject:
        "A fixture must not hand back a literal built by spreading a binding it was given. `{{subject}}` is spread into that literal. Return the output of the code this fixture exercises, and take `{{subject}}` apart in the assertion that needs it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          handlerScopingWrappers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const wrappings = handlerScopingWrappersFrom(inspection.options);

    return {
      CallExpression(node: ESTree.CallExpression) {
        for (const { at, messageId, root } of forwardedSubjectsIn({
          call: node,
          wrappers: wrappings,
        })) {
          inspection.report({
            node: at,
            messageId,
            data: { subject: inspection.sourceCode.getText(root) },
          });
        }
      },
    };
  },
});
