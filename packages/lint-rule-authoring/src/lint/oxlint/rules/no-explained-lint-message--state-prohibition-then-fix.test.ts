import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExplainedLintMessage } from "./no-explained-lint-message--state-prohibition-then-fix.ts";

const ruleShape = (description: string, complaints: string): string =>
  `const rule = createRule({ name: "a-rule", meta: { docs: { description: "${description}" }, messages: { ${complaints} } } });`;

describe("lint-rule-authoring/no-explained-lint-message--state-prohibition-then-fix", () => {
  testLintRule(noExplainedLintMessage, {
    valid: [
      {
        name: "a prohibition followed by an imperative repair direction is the sanctioned shape",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not put a value out under the name default. Name the value and export the name."',
        ),
      },
      {
        name: "a condition word inside a code span is part of the quoted code, not a branch",
        code: ruleShape(
          "Disallow a bare conditional",
          'bareConditional: "A statement must not be written as `if (ready) run();`. Move the branch into its own block."',
        ),
      },
      {
        name: "a rationale word inside a placeholder is decided at run time, not by this message",
        code: ruleShape(
          "Disallow an unresolved specifier",
          'unresolvedSpecifier: "An import must not name {{because}}. Register the owner and import through the resolved route."',
        ),
      },
      {
        name: "a template literal message is read through its quasis with the expressions masked",
        code: "const rule = createRule({ meta: { docs: { description: `Disallow a wrapper` }, messages: { unwrapped: `A block must not skip ${WRAPPER}. Wrap the block.` } } });",
      },
      {
        name: "an object that carries complaints without docs is not a rule meta",
        code: 'const rule = createRule({ meta: { messages: { note: "anything at all" } } });',
      },
      {
        name: "an object that carries docs without complaints is not a rule meta",
        code: 'const rule = createRule({ meta: { docs: { description: "anything at all" } } });',
      },
      {
        name: "an object outside a meta property carries no lint complaints to inspect",
        code: 'const probe = { docs: { description: "reports what the reader read" }, messages: { read: "{{text}}" } };',
      },
      {
        name: "a meta bound elsewhere and referenced by name is not an object literal here",
        code: "const rule = createRule({ meta: PROBE_META });",
      },
      {
        name: "a message value that is not prose carries nothing to inspect",
        code: 'const rule = createRule({ meta: { docs: { description: "Disallow a thing" }, messages: { computed: buildMessage() } } });',
      },
      {
        name: "a message value that is a number carries nothing to inspect",
        code: 'const rule = createRule({ meta: { docs: { description: "Disallow a thing" }, messages: { code: 404 } } });',
      },
      {
        name: "a computed meta key names no property this rule can resolve",
        code: 'const rule = createRule({ ["meta"]: { docs: { description: "d" }, messages: { a: "bad" } } });',
      },
      {
        name: "a meta value that is not an object carries no complaints",
        code: "const rule = createRule({ meta: 1 });",
      },
      {
        name: "a complaints value that is not an object carries no message to read",
        code: 'const rule = createRule({ meta: { docs: { description: "d" }, messages: "none" } });',
      },
      {
        name: "a spread inside meta declares neither docs nor complaints",
        code: 'const rule = createRule({ meta: { ...base, docs: { description: "d" }, messages: { a: "A thing must not stand. Delete it." } } });',
      },
      {
        name: "a spread inside complaints declares no message of its own",
        code: "const rule = createRule({ meta: { docs: { description: `d` }, messages: { ...shared } } });",
      },
      {
        name: "a member expression as a computed key resolves to no name",
        code: 'const rule = createRule({ [names.meta]: { docs: { description: "d" }, messages: { a: "bad" } } });',
      },
      {
        name: "several compliant complaints in one rule all pass",
        code: ruleShape(
          "Disallow two shapes",
          'first: "A binding must not be written to. Declare the value where the name is bound.", second: "A property must not be deleted. Take the keys to keep."',
        ),
      },
    ],
    invalid: [
      {
        name: "a because clause argues for the rule",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not use a default export, because every importing file then invents a name. Name the value and export the name."',
        ),
        errors: [
          {
            messageId: "rationaleStatement",
            data: { messageId: "defaultExport", phrase: "because" },
          },
        ],
      },
      {
        name: "an if clause makes the repair conditional",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not use a default export. Name the value and export the name. If the module owns nothing, delete it."',
        ),
        errors: [
          { messageId: "conditionStatement", data: { messageId: "defaultExport", phrase: "If" } },
        ],
      },
      {
        name: "a positive must states the target state without naming what is rejected",
        code: ruleShape(
          "Require a test file beside its source",
          'detachedTestFile: "A test file must sit beside the source it tests. Move this file into that directory."',
        ),
        errors: [{ messageId: "missingProhibition" }],
      },
      {
        name: "a message that stops at the prohibition names no repair",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not put a value out under the name default."',
        ),
        errors: [{ messageId: "missingFixDirection" }],
      },
      {
        name: "a hand-written document pointer duplicates what the factory appends",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not use a default export. Name the value and export the name. See docs/lint/no-default-export.md."',
        ),
        errors: [{ messageId: "handWrittenDocPointer" }],
      },
      {
        name: "a message written in another script is not readable by every reader of this repository",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not use a default export. 名前を付けて export する。"',
        ),
        errors: [{ messageId: "nonEnglishMessage" }, { messageId: "missingFixDirection" }],
      },
      {
        name: "a message that repeats the description carries no repair of its own",
        code: ruleShape(
          "A module must not use a default export. Name the value and export the name.",
          'defaultExport: "A module must not use a default export. Name the value and export the name."',
        ),
        errors: [{ messageId: "descriptionEcho" }],
      },
      {
        name: "a passage that points at suppression offers the shortest way out",
        code: ruleShape(
          "Disallow a default export",
          'defaultExport: "A module must not use a default export. Name the value and export the name, or disable this rule for the file."',
        ),
        errors: [{ messageId: "escapeHatchPhrase" }],
      },
      {
        name: "a message under a computed key is still read, with no id to name it by",
        code: 'const rule = createRule({ meta: { docs: { description: "d" }, messages: { [id]: "bad" } } });',
        errors: [
          { messageId: "missingProhibition", data: { messageId: "", phrase: "" } },
          { messageId: "missingFixDirection", data: { messageId: "", phrase: "" } },
        ],
      },
      {
        name: "a meta written with a string key is still a rule meta",
        code: 'const rule = createRule({ "meta": { docs: { description: "d" }, messages: { "some-id": "This must not stand." } } });',
        errors: [{ messageId: "missingFixDirection", data: { messageId: "some-id", phrase: "" } }],
      },
      {
        name: "a docs value that is not an object leaves the description unread",
        code: 'const rule = createRule({ meta: { docs: readDocs(), messages: { a: "This must not stand." } } });',
        errors: [{ messageId: "missingFixDirection" }],
      },
      {
        name: "a description that is not prose leaves the description unread",
        code: 'const rule = createRule({ meta: { docs: { description: 1 }, messages: { a: "This must not stand." } } });',
        errors: [{ messageId: "missingFixDirection" }],
      },
      {
        name: "a docs object without a description leaves the description unread",
        code: 'const rule = createRule({ meta: { docs: { relatedGuidelines: [] }, messages: { a: "This must not stand." } } });',
        errors: [{ messageId: "missingFixDirection" }],
      },
      {
        name: "each failing message in one rule is reported on its own",
        code: ruleShape(
          "Disallow two shapes",
          'first: "A binding must not be written to, because the declaration stops showing what the name holds. Declare the value where the name is bound.", second: "A property must not be deleted, because the shape changes. Take the keys to keep."',
        ),
        errors: [{ messageId: "rationaleStatement" }, { messageId: "rationaleStatement" }],
      },
    ],
  });
});
