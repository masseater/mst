import { uniq } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { fixtureDeclarationsOf } from "../lib/spec-syntax/fixture-declarations.ts";
import {
  moduleDeclarationsOf,
  type ModuleDeclarations,
} from "../lib/spec-syntax/module-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName, staticPropertyName } from "../lib/spec-syntax/static-names.ts";
import {
  blockBodyOf,
  localConstInitializer,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

type Reading = {
  readonly module: ModuleDeclarations;
  readonly factory: SpecFunction | null;
};

const boundInitializer = (reading: Reading, spelled: string): ESTree.Expression | null => {
  const writtenBody = reading.factory === null ? null : blockBodyOf(reading.factory);
  const held = writtenBody === null ? null : localConstInitializer(writtenBody, spelled);
  return held ?? reading.module.initializerByName.get(spelled) ?? null;
};

const resolvedObject = (
  reading: Reading,
  subject: ESTree.Expression,
): ESTree.ObjectExpression | null => {
  const written = unwrapSubject(subject);
  if (written.type === "ObjectExpression") return written;
  if (written.type !== "Identifier") return null;

  const held = boundInitializer(reading, written.name);
  if (held === null) return null;

  const bound = unwrapSubject(held);
  return bound.type === "ObjectExpression" ? bound : null;
};

const readNameOf = (reading: Reading, propertyValue: ESTree.Expression): string | null => {
  const written = unwrapSubject(propertyValue);
  if (written.type === "MemberExpression") return staticMemberName(written);
  if (written.type !== "Identifier") return null;

  const held = boundInitializer(reading, written.name);
  if (held === null) return null;

  const bound = unwrapSubject(held);
  return bound.type === "MemberExpression" ? staticMemberName(bound) : null;
};

const copiedNamesIn = (
  reading: Reading,
  subjectLiteral: ESTree.ObjectExpression,
): readonly string[] =>
  subjectLiteral.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    if (property.method || property.kind !== "init") return [];

    const propertyName = staticPropertyName(property);
    if (propertyName === null) return [];
    return readNameOf(reading, property.value) === propertyName ? [propertyName] : [];
  });

const reportsFor = (input: {
  readonly module: ModuleDeclarations;
  readonly call: ESTree.CallExpression;
}): readonly {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: { readonly fixture: string; readonly properties: string };
}[] =>
  fixtureDeclarationsOf(input.call).flatMap((declaration) => {
    const reading = { module: input.module, factory: declaration.factory };

    return declaration.subjects.flatMap((subject) => {
      const subjectLiteral = resolvedObject(reading, subject);
      if (subjectLiteral === null) return [];

      const copied = uniq(copiedNamesIn(reading, subjectLiteral));
      if (copied.length === 0) return [];
      return [
        {
          node: subjectLiteral,
          messageId: "copiedSubject",
          data: { fixture: declaration.name, properties: copied.join(", ") },
        },
      ];
    });
  });

export const noFixtureCopySubject = createDontReviewItRule({
  name: "no-fixture-copy-subject--yield-sut-output",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a fixture handing back a subject assembled by reading same-named properties off another value, so an assertion compares the shape the code under test produced instead of a hand-written copy that goes stale on its own",
      relatedGuidelines: [],
    },
    messages: {
      copiedSubject:
        "A fixture must not hand back a subject assembled by reading same-named properties off another value. `{{fixture}}` reads {{properties}} into keys spelled the same way. Return the value the code under test produced, whole, and read the parts an assertion needs in the `it` body. Holding the copy in a binding before handing it back, and renaming every key but one, are reported all the same.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    return {
      "Program:exit"(program: ESTree.Program) {
        const module = moduleDeclarationsOf(inspection.filename, program.body);
        const fixtures = nodesOfType(program, "CallExpression").filter(
          (call) => fixtureDeclarationsOf(call).length > 0,
        );

        for (const call of fixtures) {
          for (const report of reportsFor({ module, call })) inspection.report(report);
        }
      },
    };
  },
});
