import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { passThroughExportsIn } from "./pass-through-exports.ts";

describe("passThroughExportsIn", () => {
  describe("a re-export naming an export", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export { readFile } from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export { readFile } from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("puts that name on this module's surface", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[0],
          specifier: "retired-lib",
          exported: "readFile",
          exposed: "readFile",
        },
      ]);
    });
  });

  describe("a re-export renaming an export", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export { readFile as read } from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export { readFile as read } from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("carries the same binding under the new name", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[0],
          specifier: "retired-lib",
          exported: "readFile",
          exposed: "read",
        },
      ]);
    });
  });

  describe("an exposed name written as a string", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export { readFile as "read me" } from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export { readFile as "read me" } from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("names the same surface an identifier would", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[0],
          specifier: "retired-lib",
          exported: "readFile",
          exposed: "read me",
        },
      ]);
    });
  });

  describe("a star re-export", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(parseSync("relay.ts", 'export * from "retired-lib";').program);
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(parseSync("relay.ts", 'export * from "retired-lib";').program);
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("puts the whole surface through", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        { statement: statements[0], specifier: "retired-lib", exported: null, exposed: "*" },
      ]);
    });
  });

  describe("a namespace re-export", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export * as retired from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'export * as retired from "retired-lib";').program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("puts the whole surface through under a name", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        { statement: statements[0], specifier: "retired-lib", exported: null, exposed: "retired" },
      ]);
    });
  });

  describe("an imported binding exported again", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import { readFile } from "retired-lib";\nexport { readFile };')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import { readFile } from "retired-lib";\nexport { readFile };')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("is the same forward written in two statements", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[1],
          specifier: "retired-lib",
          exported: "readFile",
          exposed: "readFile",
        },
      ]);
    });
  });

  describe("an imported name written as a string", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync(
            "relay.ts",
            'import { "readFile" as readFile } from "retired-lib";\nexport { readFile };',
          ).program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync(
            "relay.ts",
            'import { "readFile" as readFile } from "retired-lib";\nexport { readFile };',
          ).program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("names the same export an identifier would", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[1],
          specifier: "retired-lib",
          exported: "readFile",
          exposed: "readFile",
        },
      ]);
    });
  });

  describe("an imported binding renamed on the way out", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync(
            "relay.ts",
            'import { readFile } from "retired-lib";\nexport { readFile as read };',
          ).program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync(
            "relay.ts",
            'import { readFile } from "retired-lib";\nexport { readFile as read };',
          ).program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("carries the same forward under the new name", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[1],
          specifier: "retired-lib",
          exported: "readFile",
          exposed: "read",
        },
      ]);
    });
  });

  describe("an imported namespace exported again", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import * as retired from "retired-lib";\nexport { retired };')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import * as retired from "retired-lib";\nexport { retired };')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("puts the whole surface through", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        { statement: statements[1], specifier: "retired-lib", exported: null, exposed: "retired" },
      ]);
    });
  });

  describe("an imported default binding exported again", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import retired from "retired-lib";\nexport default retired;')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import retired from "retired-lib";\nexport default retired;')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("carries the default export out", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        {
          statement: statements[1],
          specifier: "retired-lib",
          exported: "default",
          exposed: "default",
        },
      ]);
    });
  });

  describe("a required binding exported again", () => {
    const it = test
      .extend("statements", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import retired = require("retired-lib");\nexport { retired };')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return statementsOf(program);
      })
      .extend("forwards", () => {
        const program = astFieldsOf(
          parseSync("relay.ts", 'import retired = require("retired-lib");\nexport { retired };')
            .program,
        );
        if (program === null) throw new Error("relay.ts held nothing to read");
        return passThroughExportsIn(statementsOf(program));
      });

    it("is a forward as much as an import is", ({ forwards, statements }) => {
      expect(forwards).toStrictEqual([
        { statement: statements[1], specifier: "retired-lib", exported: null, exposed: "retired" },
      ]);
    });
  });

  describe("a binding this module declared then exported by name", () => {
    const it = test.extend("forwards", () => {
      const program = astFieldsOf(
        parseSync("relay.ts", "const total = 1;\nexport { total };").program,
      );
      if (program === null) throw new Error("relay.ts held nothing to read");
      return passThroughExportsIn(statementsOf(program));
    });

    it("is no forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a declaration this module writes itself", () => {
    const it = test.extend("forwards", () => {
      const program = astFieldsOf(parseSync("relay.ts", "export const total = 1;").program);
      if (program === null) throw new Error("relay.ts held nothing to read");
      return passThroughExportsIn(statementsOf(program));
    });

    it("is no forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a binding this module computed from an import", () => {
    const it = test.extend("forwards", () => {
      const program = astFieldsOf(
        parseSync(
          "relay.ts",
          'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);',
        ).program,
      );
      if (program === null) throw new Error("relay.ts held nothing to read");
      return passThroughExportsIn(statementsOf(program));
    });

    it("is no forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an import that is never exported again", () => {
    const it = test.extend("forwards", () => {
      const program = astFieldsOf(
        parseSync("relay.ts", 'import { readFile } from "retired-lib";\nvoid readFile;').program,
      );
      if (program === null) throw new Error("relay.ts held nothing to read");
      return passThroughExportsIn(statementsOf(program));
    });

    it("is no forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a default export of a value this module built", () => {
    const it = test.extend("forwards", () => {
      const program = astFieldsOf(parseSync("relay.ts", "export default 1;").program);
      if (program === null) throw new Error("relay.ts held nothing to read");
      return passThroughExportsIn(statementsOf(program));
    });

    it("is no forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an import holding nothing it brought in", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([{ type: "ImportDeclaration", source: { value: "retired-lib" } }]));

    it("is no forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a star re-export whose source is not written out", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        { type: "ExportAllDeclaration", source: { type: "Literal", value: 1 } },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a sourced export that names nothing", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        { type: "ExportNamedDeclaration", source: { type: "Literal", value: "retired-lib" } },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a sourced export that puts no name on the surface", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "ExportNamedDeclaration",
          source: { type: "Literal", value: "retired-lib" },
          specifiers: [
            {
              type: "ExportSpecifier",
              local: { type: "Identifier", name: "readFile" },
              exported: null,
            },
          ],
        },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an export of a binding whose name is not written out", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "ExportNamedDeclaration",
          specifiers: [
            {
              type: "ExportSpecifier",
              local: { type: "Identifier", name: 1 },
              exported: { type: "Identifier", name: "read" },
            },
          ],
        },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an export of a binding named by a written out string", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "ExportNamedDeclaration",
          specifiers: [
            {
              type: "ExportSpecifier",
              local: { type: "Literal", value: "readFile" },
              exported: { type: "Identifier", name: "read" },
            },
          ],
        },
      ]));

    it("reaches no import of this module", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an export of a binding whose name is no text at all", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "ExportNamedDeclaration",
          specifiers: [
            {
              type: "ExportSpecifier",
              local: { type: "Literal", value: 1 },
              exported: { type: "Identifier", name: "read" },
            },
          ],
        },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an import whose source is not written out", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        { type: "ImportDeclaration", source: { type: "Literal", value: 1 }, specifiers: [] },
      ]));

    it("binds nothing to forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an import specifier carrying no local name", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "ImportDeclaration",
          source: { type: "Literal", value: "retired-lib" },
          specifiers: [
            { type: "ImportSpecifier", imported: { type: "Identifier", name: "readFile" } },
          ],
        },
      ]));

    it("binds nothing to forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("an alias standing for another namespace of this program", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "TSImportEqualsDeclaration",
          id: { type: "Identifier", name: "retired" },
          moduleReference: { type: "TSQualifiedName" },
        },
      ]));

    it("binds no module", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a required module that is not written out", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        {
          type: "TSImportEqualsDeclaration",
          id: { type: "Identifier", name: "retired" },
          moduleReference: {
            type: "TSExternalModuleReference",
            expression: { type: "Literal", value: 1 },
          },
        },
      ]));

    it("binds nothing to forward", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a default export of a name that is not written out", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        { type: "ExportDefaultDeclaration", declaration: { type: "Identifier", name: 1 } },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a default export of a binding this module declared itself", () => {
    const it = test.extend("forwards", () =>
      passThroughExportsIn([
        { type: "ExportDefaultDeclaration", declaration: { type: "Identifier", name: "held" } },
      ]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });

  describe("a statement that is not a node at all", () => {
    const it = test.extend("forwards", () => passThroughExportsIn([null]));

    it("forwards nothing", ({ forwards }) => {
      expect(forwards).toStrictEqual([]);
    });
  });
});
