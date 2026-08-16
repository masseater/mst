import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { staticMemberOf } from "../../lib/static-member.ts";
import { hasWrittenOutText } from "../../lib/written-out-text.ts";

import type { ESTree } from "@oxlint/plugins";

const PLATFORM_SPECIFIER_PREFIX = "node:";

const LOCAL_SPECIFIER_PREFIXES = [".", "/", "#"];

const isProviderPackage = (source: string): boolean => {
  if (source === "" || source.startsWith(PLATFORM_SPECIFIER_PREFIX)) return false;
  return !LOCAL_SPECIFIER_PREFIXES.some((prefix) => source.startsWith(prefix));
};

const providerBindingNamesIn = (program: ESTree.Program): readonly string[] =>
  program.body.flatMap((statement) =>
    statement.type === "ImportDeclaration" && isProviderPackage(statement.source.value)
      ? statement.specifiers.map((specifier) => specifier.local.name)
      : [],
  );

const isProviderConstructor = (
  callee: ESTree.Expression,
  providerBindings: ReadonlySet<string>,
): boolean => {
  const written = callee;
  if (written.type === "Identifier") return providerBindings.has(written.name);
  const member = staticMemberOf(written);
  if (member === null) return false;
  const receiver = member.object;
  return receiver.type === "Identifier" && providerBindings.has(receiver.name);
};

const PROVIDER_IDENTITY_KEYS: ReadonlySet<string> = new Set([
  "accessKeyId",
  "accessToken",
  "accountId",
  "apiKey",
  "apiSecret",
  "apiToken",
  "appId",
  "applicationId",
  "authToken",
  "clientId",
  "clientSecret",
  "dsn",
  "organizationId",
  "privateKey",
  "projectId",
  "publicKey",
  "secretAccessKey",
  "tenantId",
  "token",
  "workspaceId",
]);

const identityKeyNameOf = (property: ESTree.ObjectProperty): string | null => {
  const { key } = property;
  if (key.type === "Literal") return typeof key.value === "string" ? key.value : null;
  return key.type === "Identifier" && !property.computed ? key.name : null;
};

const writtenOutIdentityOf = (property: ESTree.ObjectProperty): ESTree.Expression | null => {
  const identityKeyName = identityKeyNameOf(property);
  if (identityKeyName === null || !PROVIDER_IDENTITY_KEYS.has(identityKeyName)) return null;
  return hasWrittenOutText(property.value) ? property.value : null;
};

const writtenOutIdentitiesIn = (expression: ESTree.Expression): readonly ESTree.Expression[] => {
  const written = expression;
  if (written.type !== "ObjectExpression") return [];

  return written.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    if (property.value.type === "ObjectExpression") {
      return writtenOutIdentitiesIn(property.value);
    }
    const identity = writtenOutIdentityOf(property);
    return identity === null ? [] : [identity];
  });
};

const writtenOutIdentitiesOf = (node: ESTree.NewExpression): readonly ESTree.Expression[] =>
  node.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : writtenOutIdentitiesIn(argument),
  );

export const noHardcodedProviderId = createDontReviewItRule({
  name: "no-hardcoded-provider-id--read-from-configuration",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow text written out in the source at an identity argument of a client built from a provider package, so which account a deployment acts as is decided by its configuration rather than by the file that builds the client",
      relatedGuidelines: [],
    },
    messages: {
      hardcodedProviderId:
        "A client built from a provider package must not take the identity it acts as from text written out in this file. Read the identity from configuration and pass it in: take it from the environment the process was started with, or accept it as a parameter of the function that builds the client.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      "Program:exit"(program: ESTree.Program) {
        const providerBindings: ReadonlySet<string> = new Set(providerBindingNamesIn(program));

        for (const node of nodesOfType(program, "NewExpression")) {
          if (!isProviderConstructor(node.callee, providerBindings)) continue;
          for (const identity of writtenOutIdentitiesOf(node)) {
            inspection.report({ node: identity, messageId: "hardcodedProviderId" });
          }
        }
      },
    };
  },
});
