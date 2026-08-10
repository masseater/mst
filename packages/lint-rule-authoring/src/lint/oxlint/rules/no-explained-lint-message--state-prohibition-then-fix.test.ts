import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExplainedLintMessage } from "./no-explained-lint-message--state-prohibition-then-fix.ts";

const ruleShape = (description: string, messages: string): string =>
  `const meta = { docs: { description: "${description}" }, messages: { ${messages} } };`;

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
        code: "const meta = { docs: { description: `Disallow a wrapper` }, messages: { unwrapped: `A block must not skip ${WRAPPER}. Wrap the block.` } };",
      },
      {
        name: "an object that carries messages without docs is not a rule meta",
        code: 'const bag = { messages: { note: "anything at all" } };',
      },
      {
        name: "an object that carries docs without messages is not a rule meta",
        code: 'const bag = { docs: { description: "anything at all" } };',
      },
      {
        name: "a message value that is not prose carries nothing to inspect",
        code: 'const meta = { docs: { description: "Disallow a thing" }, messages: { computed: buildMessage() } };',
      },
      {
        name: "several compliant messages in one rule all pass",
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
