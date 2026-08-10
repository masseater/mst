import { createDontReviewItRule } from "../../../create-rule.ts";
import { withoutParentheses } from "../lib/parenthesized-expression.ts";
import { staticMemberOf } from "../lib/static-member.ts";
import { hasWrittenOutText } from "../lib/written-out-text.ts";

import type { ESTree } from "@oxlint/plugins";

const PLATFORM_SPECIFIER_PREFIX = "node:";

const LOCAL_SPECIFIER_PREFIXES = [".", "/", "#"];

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

const identityKeyNameOf = (property: ESTree.ObjectProperty): string | null => {
  if (property.computed) return null;
  const { key } = property;
  if (key.type === "Identifier") return key.name;
  if (key.type !== "Literal") return null;
  return typeof key.value === "string" ? key.value : null;
};

const writtenOutIdentityOf = (property: ESTree.ObjectProperty): ESTree.Expression | null => {
  const name = identityKeyNameOf(property);
  if (name === null || !PROVIDER_IDENTITY_KEYS.has(name)) return null;
  return hasWrittenOutText(property.value) ? property.value : null;
};

const writtenOutIdentitiesIn = (expression: ESTree.Expression): readonly ESTree.Expression[] => {
  const written = withoutParentheses(expression);
  if (written.type !== "ObjectExpression") return [];

  return written.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    if (withoutParentheses(property.value).type === "ObjectExpression") {
      return writtenOutIdentitiesIn(property.value);
    }
    const identity = writtenOutIdentityOf(property);
    return identity === null ? [] : [identity];
  });
};

const isProviderConstructor = (
  callee: ESTree.Expression,
  providerBindings: ReadonlySet<string>,
): boolean => {
  const written = withoutParentheses(callee);
  if (written.type === "Identifier") return providerBindings.has(written.name);
  const member = staticMemberOf(written);
  if (member === null) return false;
  const receiver = withoutParentheses(member.object);
  return receiver.type === "Identifier" && providerBindings.has(receiver.name);
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
        "A client built from a provider package must not take the identity it acts as from text written out in this file, because that identity is the one part of the connection that differs between every deployment: the same source has to act as a sandbox account under test, a staging account during review, and the real account in production, and text baked into the construction can be none of those without an edit. What follows is a build that only works for the account its author happened to have, a test run that touches real data because nothing pointed it elsewhere, and a credential that is now in the history of this repository and stays there after it is deleted from the current file. Read the identity from configuration and pass it in: take it from the environment the process was started with, or accept it as a parameter of the function that builds the client so the caller decides. Whether the text looks like an identifier is not what is being reported. Any written-out text at this argument is, because this argument is who the connection acts as.",
    },
    schema: [],
  },
  create(context) {
    const providerBindings = new Set<string>();

    return {
      Program(node: ESTree.Program) {
        for (const name of providerBindingNamesIn(node)) providerBindings.add(name);
      },
      NewExpression(node: ESTree.NewExpression) {
        if (!isProviderConstructor(node.callee, providerBindings)) return;
        for (const identity of writtenOutIdentitiesOf(node)) {
          context.report({ node: identity, messageId: "hardcodedProviderId" });
        }
      },
    };
  },
});
