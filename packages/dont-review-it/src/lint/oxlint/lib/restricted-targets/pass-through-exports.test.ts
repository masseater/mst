import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { passThroughExportsIn } from "./pass-through-exports.ts";

const it = test
  .extend("statementsOfAReExportNamingAnExport", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'export { readFile } from "retired-lib";').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAReExportNamingAnExport", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'export { readFile } from "retired-lib";').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfAReExportRenamingAnExport", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'export { readFile as read } from "retired-lib";').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAReExportRenamingAnExport", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'export { readFile as read } from "retired-lib";').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfAStarReExport", () => {
    const program = astFieldsOf(parseSync("relay.ts", 'export * from "retired-lib";').program);
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAStarReExport", () => {
    const program = astFieldsOf(parseSync("relay.ts", 'export * from "retired-lib";').program);
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfANamespaceReExport", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'export * as retired from "retired-lib";').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfANamespaceReExport", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'export * as retired from "retired-lib";').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfAnExportedImportedBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import { readFile } from "retired-lib";\nexport { readFile };')
        .program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAnExportedImportedBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import { readFile } from "retired-lib";\nexport { readFile };')
        .program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfARenamedImportedBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import { readFile } from "retired-lib";\nexport { readFile as read };')
        .program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfARenamedImportedBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import { readFile } from "retired-lib";\nexport { readFile as read };')
        .program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfAnExportedImportedNamespace", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import * as retired from "retired-lib";\nexport { retired };').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAnExportedImportedNamespace", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import * as retired from "retired-lib";\nexport { retired };').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfAnExportedDefaultBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import retired from "retired-lib";\nexport default retired;').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAnExportedDefaultBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import retired from "retired-lib";\nexport default retired;').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("statementsOfAnExportedRequiredBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import retired = require("retired-lib");\nexport { retired };')
        .program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return statementsOf(program);
  })
  .extend("forwardsOfAnExportedRequiredBinding", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import retired = require("retired-lib");\nexport { retired };')
        .program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("forwardsOfADeclarationThisModuleWritesItself", () => {
    const program = astFieldsOf(parseSync("relay.ts", "export const total = 1;").program);
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("forwardsOfABindingComputedFromAnImport", () => {
    const program = astFieldsOf(
      parseSync(
        "relay.ts",
        'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);',
      ).program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("forwardsOfAnImportThatIsNeverExportedAgain", () => {
    const program = astFieldsOf(
      parseSync("relay.ts", 'import { readFile } from "retired-lib";\nvoid readFile;').program,
    );
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("forwardsOfADefaultExportOfAValueThisModuleBuilt", () => {
    const program = astFieldsOf(parseSync("relay.ts", "export default 1;").program);
    if (program === null) throw new Error("relay.ts held nothing to read");
    return passThroughExportsIn(statementsOf(program));
  })
  .extend("forwardsOfAStarExportWhoseSourceIsNotWrittenOut", () =>
    passThroughExportsIn([{ type: "ExportAllDeclaration", source: { type: "Literal", value: 1 } }]),
  )
  .extend("forwardsOfASourcedExportCarryingNoSpecifiers", () =>
    passThroughExportsIn([
      { type: "ExportNamedDeclaration", source: { type: "Literal", value: "retired-lib" } },
    ]),
  )
  .extend("forwardsOfASourcedExportWithoutAnExposedName", () =>
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
    ]),
  )
  .extend("forwardsOfALocalExportWhoseNameIsNotWrittenOut", () =>
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
    ]),
  )
  .extend("forwardsOfALocalExportNamedByAWrittenOutString", () =>
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
    ]),
  )
  .extend("forwardsOfALocalExportWhoseNameIsNoText", () =>
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
    ]),
  )
  .extend("forwardsOfAnImportWhoseSourceIsNotWrittenOut", () =>
    passThroughExportsIn([
      { type: "ImportDeclaration", source: { type: "Literal", value: 1 }, specifiers: [] },
    ]),
  )
  .extend("forwardsOfAnImportSpecifierWithoutALocalName", () =>
    passThroughExportsIn([
      {
        type: "ImportDeclaration",
        source: { type: "Literal", value: "retired-lib" },
        specifiers: [
          { type: "ImportSpecifier", imported: { type: "Identifier", name: "readFile" } },
        ],
      },
    ]),
  )
  .extend("forwardsOfAnAliasOfAnotherNamespace", () =>
    passThroughExportsIn([
      {
        type: "TSImportEqualsDeclaration",
        id: { type: "Identifier", name: "retired" },
        moduleReference: { type: "TSQualifiedName" },
      },
    ]),
  )
  .extend("forwardsOfARequiredModuleThatIsNotWrittenOut", () =>
    passThroughExportsIn([
      {
        type: "TSImportEqualsDeclaration",
        id: { type: "Identifier", name: "retired" },
        moduleReference: {
          type: "TSExternalModuleReference",
          expression: { type: "Literal", value: 1 },
        },
      },
    ]),
  )
  .extend("forwardsOfADefaultExportOfANameThatIsNotWrittenOut", () =>
    passThroughExportsIn([
      { type: "ExportDefaultDeclaration", declaration: { type: "Identifier", name: 1 } },
    ]),
  )
  .extend("forwardsOfADefaultExportOfABindingThisModuleDeclared", () =>
    passThroughExportsIn([
      { type: "ExportDefaultDeclaration", declaration: { type: "Identifier", name: "held" } },
    ]),
  )
  .extend("forwardsOfAStatementThatIsNotANode", () => passThroughExportsIn([null]));

describe("restricted-targets/pass-through-exports", () => {
  it("a re-export naming an export puts that name on this module's surface", ({
    forwardsOfAReExportNamingAnExport,
    statementsOfAReExportNamingAnExport,
  }) => {
    expect(forwardsOfAReExportNamingAnExport).toStrictEqual([
      {
        statement: statementsOfAReExportNamingAnExport[0],
        specifier: "retired-lib",
        exported: "readFile",
        exposed: "readFile",
      },
    ]);
  });

  it("a re-export renaming an export carries the same binding under the new name", ({
    forwardsOfAReExportRenamingAnExport,
    statementsOfAReExportRenamingAnExport,
  }) => {
    expect(forwardsOfAReExportRenamingAnExport).toStrictEqual([
      {
        statement: statementsOfAReExportRenamingAnExport[0],
        specifier: "retired-lib",
        exported: "readFile",
        exposed: "read",
      },
    ]);
  });

  it("a star re-export puts the whole surface through", ({
    forwardsOfAStarReExport,
    statementsOfAStarReExport,
  }) => {
    expect(forwardsOfAStarReExport).toStrictEqual([
      {
        statement: statementsOfAStarReExport[0],
        specifier: "retired-lib",
        exported: null,
        exposed: "*",
      },
    ]);
  });

  it("a namespace re-export puts the whole surface through under a name", ({
    forwardsOfANamespaceReExport,
    statementsOfANamespaceReExport,
  }) => {
    expect(forwardsOfANamespaceReExport).toStrictEqual([
      {
        statement: statementsOfANamespaceReExport[0],
        specifier: "retired-lib",
        exported: null,
        exposed: "retired",
      },
    ]);
  });

  it("exporting an imported binding is the same forward written in two statements", ({
    forwardsOfAnExportedImportedBinding,
    statementsOfAnExportedImportedBinding,
  }) => {
    expect(forwardsOfAnExportedImportedBinding).toStrictEqual([
      {
        statement: statementsOfAnExportedImportedBinding[1],
        specifier: "retired-lib",
        exported: "readFile",
        exposed: "readFile",
      },
    ]);
  });

  it("renaming an imported binding on the way out changes nothing", ({
    forwardsOfARenamedImportedBinding,
    statementsOfARenamedImportedBinding,
  }) => {
    expect(forwardsOfARenamedImportedBinding).toStrictEqual([
      {
        statement: statementsOfARenamedImportedBinding[1],
        specifier: "retired-lib",
        exported: "readFile",
        exposed: "read",
      },
    ]);
  });

  it("exporting an imported namespace puts the whole surface through", ({
    forwardsOfAnExportedImportedNamespace,
    statementsOfAnExportedImportedNamespace,
  }) => {
    expect(forwardsOfAnExportedImportedNamespace).toStrictEqual([
      {
        statement: statementsOfAnExportedImportedNamespace[1],
        specifier: "retired-lib",
        exported: null,
        exposed: "retired",
      },
    ]);
  });

  it("exporting an imported default binding carries the default export out", ({
    forwardsOfAnExportedDefaultBinding,
    statementsOfAnExportedDefaultBinding,
  }) => {
    expect(forwardsOfAnExportedDefaultBinding).toStrictEqual([
      {
        statement: statementsOfAnExportedDefaultBinding[1],
        specifier: "retired-lib",
        exported: "default",
        exposed: "default",
      },
    ]);
  });

  it("a required binding exported again is a forward as much as an import is", ({
    forwardsOfAnExportedRequiredBinding,
    statementsOfAnExportedRequiredBinding,
  }) => {
    expect(forwardsOfAnExportedRequiredBinding).toStrictEqual([
      {
        statement: statementsOfAnExportedRequiredBinding[1],
        specifier: "retired-lib",
        exported: null,
        exposed: "retired",
      },
    ]);
  });

  it("a declaration this module writes itself is no forward", ({
    forwardsOfADeclarationThisModuleWritesItself,
  }) => {
    expect(forwardsOfADeclarationThisModuleWritesItself).toStrictEqual([]);
  });

  it("a binding this module computed from an import is no forward", ({
    forwardsOfABindingComputedFromAnImport,
  }) => {
    expect(forwardsOfABindingComputedFromAnImport).toStrictEqual([]);
  });

  it("an import that is never exported again is no forward", ({
    forwardsOfAnImportThatIsNeverExportedAgain,
  }) => {
    expect(forwardsOfAnImportThatIsNeverExportedAgain).toStrictEqual([]);
  });

  it("a default export of a value this module built is no forward", ({
    forwardsOfADefaultExportOfAValueThisModuleBuilt,
  }) => {
    expect(forwardsOfADefaultExportOfAValueThisModuleBuilt).toStrictEqual([]);
  });

  it("a star re-export whose source is not written out forwards nothing", ({
    forwardsOfAStarExportWhoseSourceIsNotWrittenOut,
  }) => {
    expect(forwardsOfAStarExportWhoseSourceIsNotWrittenOut).toStrictEqual([]);
  });

  it("a sourced export that names nothing forwards nothing", ({
    forwardsOfASourcedExportCarryingNoSpecifiers,
  }) => {
    expect(forwardsOfASourcedExportCarryingNoSpecifiers).toStrictEqual([]);
  });

  it("a sourced export that puts no name on the surface forwards nothing", ({
    forwardsOfASourcedExportWithoutAnExposedName,
  }) => {
    expect(forwardsOfASourcedExportWithoutAnExposedName).toStrictEqual([]);
  });

  it("an export of a binding whose name is not written out forwards nothing", ({
    forwardsOfALocalExportWhoseNameIsNotWrittenOut,
  }) => {
    expect(forwardsOfALocalExportWhoseNameIsNotWrittenOut).toStrictEqual([]);
  });

  it("an export of a binding named by a written out string reaches no import of this module", ({
    forwardsOfALocalExportNamedByAWrittenOutString,
  }) => {
    expect(forwardsOfALocalExportNamedByAWrittenOutString).toStrictEqual([]);
  });

  it("an export of a binding whose name is no text at all forwards nothing", ({
    forwardsOfALocalExportWhoseNameIsNoText,
  }) => {
    expect(forwardsOfALocalExportWhoseNameIsNoText).toStrictEqual([]);
  });

  it("an import whose source is not written out binds nothing to forward", ({
    forwardsOfAnImportWhoseSourceIsNotWrittenOut,
  }) => {
    expect(forwardsOfAnImportWhoseSourceIsNotWrittenOut).toStrictEqual([]);
  });

  it("an import specifier carrying no local name binds nothing to forward", ({
    forwardsOfAnImportSpecifierWithoutALocalName,
  }) => {
    expect(forwardsOfAnImportSpecifierWithoutALocalName).toStrictEqual([]);
  });

  it("an alias standing for another namespace of this program binds no module", ({
    forwardsOfAnAliasOfAnotherNamespace,
  }) => {
    expect(forwardsOfAnAliasOfAnotherNamespace).toStrictEqual([]);
  });

  it("a required module that is not written out binds nothing to forward", ({
    forwardsOfARequiredModuleThatIsNotWrittenOut,
  }) => {
    expect(forwardsOfARequiredModuleThatIsNotWrittenOut).toStrictEqual([]);
  });

  it("a default export of a name that is not written out forwards nothing", ({
    forwardsOfADefaultExportOfANameThatIsNotWrittenOut,
  }) => {
    expect(forwardsOfADefaultExportOfANameThatIsNotWrittenOut).toStrictEqual([]);
  });

  it("a default export of a binding this module declared itself forwards nothing", ({
    forwardsOfADefaultExportOfABindingThisModuleDeclared,
  }) => {
    expect(forwardsOfADefaultExportOfABindingThisModuleDeclared).toStrictEqual([]);
  });

  it("a statement that is not a node at all forwards nothing", ({
    forwardsOfAStatementThatIsNotANode,
  }) => {
    expect(forwardsOfAStatementThatIsNotANode).toStrictEqual([]);
  });
});
