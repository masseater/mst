import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noReplacedDoubleBehaviour } from "./no-replaced-double-behaviour--let-the-replaced-module-answer.ts";

const IMPORTED_DOUBLE = 'import { send } from "./mailer.ts";\n';

const IMPORTED_MODULE = 'import * as mailer from "./mailer.ts";\n';

const GROUNDED_EXEMPTION =
  "// mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- the transport cannot be made to fail from outside";

const GROUNDLESS_EXEMPTION =
  "// mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer";

const SPEC_FILE = "packages/mailer/src/send.test.ts";

describe("dont-review-it/no-replaced-double-behaviour--let-the-replaced-module-answer", () => {
  testLintRule(noReplacedDoubleBehaviour, {
    valid: [
      {
        name: "a double the spec created itself is a test input and may answer",
        code: "const send = vi.fn();\nsend.mockReturnValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "a double built beside the test and handed to the subject may answer",
        code: "const send = vi.fn();\nconst passed = send;\npassed.mockResolvedValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "reading a member off the replaced module settles nothing",
        code: `${IMPORTED_MODULE}const seen = vi.mocked(mailer).send;`,
        filename: SPEC_FILE,
      },
      {
        name: "a member reached through a name that only settles at run time cannot be read",
        code: `${IMPORTED_DOUBLE}vi.mocked(send)[member](1);`,
        filename: SPEC_FILE,
      },
      {
        name: "another member on the replaced double is not a setting",
        code: `${IMPORTED_DOUBLE}vi.mocked(send).mockClear();`,
        filename: SPEC_FILE,
      },
      {
        name: "a file that is not a spec is never looked at",
        code: `${IMPORTED_DOUBLE}send.mockReturnValue(1);`,
        filename: "packages/mailer/src/send.ts",
      },
      {
        name: "grounds written above the call carry the exemption",
        code: `${IMPORTED_DOUBLE}${GROUNDED_EXEMPTION}\nsend.mockRejectedValue(1);`,
        filename: SPEC_FILE,
      },
      {
        name: "a setting on something the spec never imported is not a replaced double",
        code: "helpers.send.mockReturnValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "the same view member on something that is not the runner is a different call",
        code: `${IMPORTED_DOUBLE}helpers.mocked(send).mockReturnValue(1);`,
        filename: SPEC_FILE,
      },
      {
        name: "a view handed nothing names no double",
        code: `${IMPORTED_DOUBLE}vi.mocked().mockReturnValue(1);`,
        filename: SPEC_FILE,
      },
      {
        name: "a view handed a spread names no double that can be read",
        code: `${IMPORTED_DOUBLE}vi.mocked(...taken).mockReturnValue(1);`,
        filename: SPEC_FILE,
      },
      {
        name: "a setting reached through the parent class is not a binding this spec imported",
        code: "class Held {\n  hold() {\n    super.mockReturnValue(1);\n  }\n}",
        filename: SPEC_FILE,
      },
      {
        name: "a member reached through the parent class carries no import either",
        code: "class Held {\n  hold() {\n    super.send.mockReturnValue(1);\n  }\n}",
        filename: SPEC_FILE,
      },
      {
        name: "a name declared as a function in this file is not a replaced double",
        code: "function built() {}\nbuilt.mockReturnValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "a name bound to nothing carries no double",
        code: "let held;\nheld.mockReturnValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "a double handed back by a call the spec makes is not a replaced double",
        code: "build().mockReturnValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "a setting written on a value that carries no name carries no import either",
        code: "({}).mockReturnValue(1);",
        filename: SPEC_FILE,
      },
      {
        name: "names bound to each other are followed once and then left",
        code: "const first = second;\nconst second = first;\nfirst.mockReturnValue(1);",
        filename: SPEC_FILE,
      },
    ],
    invalid: [
      {
        name: "a return value written on an imported double is reported",
        code: `${IMPORTED_DOUBLE}send.mockReturnValue(1);`,
        filename: SPEC_FILE,
        errors: [{ messageId: "replacedDoubleBehaviour" }],
      },
      {
        name: "the same setting written through the runner's view is reported",
        code: `${IMPORTED_DOUBLE}vi.mocked(send).mockResolvedValue(1);`,
        filename: SPEC_FILE,
        errors: [{ messageId: "replacedDoubleBehaviour" }],
      },
      {
        name: "a member of the replaced module reached through the runner's view is reported",
        code: `${IMPORTED_MODULE}vi.mocked(mailer).send.mockImplementation(() => 1);`,
        filename: SPEC_FILE,
        errors: [{ messageId: "replacedDoubleBehaviour" }],
      },
      {
        name: "the view parked in a binding is still the replaced double",
        code: `${IMPORTED_DOUBLE}const double = vi.mocked(send);\ndouble.mockReturnValueOnce(1);`,
        filename: SPEC_FILE,
        errors: [{ messageId: "replacedDoubleBehaviour" }],
      },
      {
        name: "a setting inside a fixture is reported the same as one outside",
        code: `${IMPORTED_DOUBLE}const it = test.extend("theSent", () => {\n  send.mockReturnValue(1);\n  return send;\n});`,
        filename: SPEC_FILE,
        errors: [{ messageId: "replacedDoubleBehaviour" }],
      },
      {
        name: "an exemption without grounds is reported beside the setting it fails to carry",
        code: `${IMPORTED_DOUBLE}${GROUNDLESS_EXEMPTION}\nsend.mockReturnValue(1);`,
        filename: SPEC_FILE,
        errors: [{ messageId: "unreasonedExemption" }, { messageId: "replacedDoubleBehaviour" }],
      },
    ],
  });
});
