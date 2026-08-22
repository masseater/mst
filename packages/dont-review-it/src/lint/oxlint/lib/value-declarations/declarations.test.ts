import { describe, expect, test } from "vite-plus/test";

import { valueDeclarationsIn } from "./declarations.ts";

const RELATIVE_PATH = "packages/one/src/read.ts";

describe("valueDeclarationsIn", () => {
  describe("a constant holding a literal", () => {
    const it = test
      .extend("declarationsOfAConstant", () =>
        valueDeclarationsIn({ source: `const seed = 1;`, relativePath: RELATIVE_PATH }))
      .extend("declarationsOfAConstantHoldingTwo", () =>
        valueDeclarationsIn({ source: `const seed = 2;`, relativePath: RELATIVE_PATH }),
      );

    it("reads a constant under the name it was declared with", ({ declarationsOfAConstant }) => {
      expect(declarationsOfAConstant).toStrictEqual([
        {
          name: "seed",
          line: 1,
          exported: false,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
      ]);
    });

    it("keeps two constants apart when their bodies hold different values", ({
      declarationsOfAConstant,
      declarationsOfAConstantHoldingTwo,
    }) => {
      expect(declarationsOfAConstant).not.toStrictEqual(declarationsOfAConstantHoldingTwo);
    });
  });

  describe("a function declaration", () => {
    const it = test.extend("declarationsOfAFunction", () =>
      valueDeclarationsIn({
        source: `function run(step: number) { return step; }`,
        relativePath: RELATIVE_PATH,
      }));

    it("reads a function declaration as a declared value", ({ declarationsOfAFunction }) => {
      expect(declarationsOfAFunction).toStrictEqual([
        {
          name: "run",
          line: 1,
          exported: false,
          fingerprint: `{async:false,body:{type:"BlockStatement",body:[{type:"ReturnStatement",argument:{type:"Identifier",decorators:[],name:"step",optional:false,typeAnnotation:null}}]},generator:false,params:[{type:"Identifier",decorators:[],name:"step",optional:false,typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSNumberKeyword"}}}],returnType:null,typeParameters:null}`,
        },
      ]);
    });
  });

  describe("a class declaration", () => {
    const it = test.extend("declarationsOfAClass", () =>
      valueDeclarationsIn({ source: `class Owner {}`, relativePath: RELATIVE_PATH }));

    it("reads a class declaration as a declared value", ({ declarationsOfAClass }) => {
      expect(declarationsOfAClass).toStrictEqual([
        {
          name: "Owner",
          line: 1,
          exported: false,
          fingerprint: `{body:{type:"ClassBody",body:[]},decorators:[],implements:[],superClass:null,superTypeArguments:null,typeParameters:null}`,
        },
      ]);
    });
  });

  describe("a type alias", () => {
    const it = test.extend("declarationsOfATypeAlias", () =>
      valueDeclarationsIn({
        source: `export type Held = { readonly id: string };`,
        relativePath: RELATIVE_PATH,
      }));

    it("leaves a type declaration out", ({ declarationsOfATypeAlias }) => {
      expect(declarationsOfATypeAlias).toStrictEqual([]);
    });
  });

  describe("a binding spreading into several names", () => {
    const it = test.extend("declarationsOfABindingSpreadingIntoSeveralNames", () =>
      valueDeclarationsIn({
        source: `const { first, second } = split();`,
        relativePath: RELATIVE_PATH,
      }));

    it("leaves a binding that spreads into several names out", ({
      declarationsOfABindingSpreadingIntoSeveralNames,
    }) => {
      expect(declarationsOfABindingSpreadingIntoSeveralNames).toStrictEqual([]);
    });
  });

  describe("a default export", () => {
    const it = test.extend("declarationsOfADefaultExport", () =>
      valueDeclarationsIn({ source: `export default 3;`, relativePath: RELATIVE_PATH }));

    it("leaves a default export out", ({ declarationsOfADefaultExport }) => {
      expect(declarationsOfADefaultExport).toStrictEqual([]);
    });
  });

  describe("a constant carrying its own export keyword", () => {
    const it = test.extend("declarationsOfAConstantExportedWhereItStands", () =>
      valueDeclarationsIn({
        source: `export const seed = 1;\nconst kept = 2;`,
        relativePath: RELATIVE_PATH,
      }));

    it("marks a declaration carried out by its own export keyword", ({
      declarationsOfAConstantExportedWhereItStands,
    }) => {
      expect(declarationsOfAConstantExportedWhereItStands).toStrictEqual([
        {
          name: "seed",
          line: 1,
          exported: true,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
        {
          name: "kept",
          line: 2,
          exported: false,
          fingerprint: `{annotation:null,init:{type:"Literal",value:2,raw:"2"}}`,
        },
      ]);
    });
  });

  describe("a constant sent away by a later export statement", () => {
    const it = test.extend("declarationsOfAConstantSentAwayLater", () =>
      valueDeclarationsIn({
        source: `const seed = 1;\nexport { seed };`,
        relativePath: RELATIVE_PATH,
      }));

    it("marks a declaration sent away by a later export statement", ({
      declarationsOfAConstantSentAwayLater,
    }) => {
      expect(declarationsOfAConstantSentAwayLater).toStrictEqual([
        {
          name: "seed",
          line: 1,
          exported: true,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
      ]);
    });
  });

  describe("a constant standing beside a re-export of its name", () => {
    const it = test.extend("declarationsOfAConstantBesideAReExport", () =>
      valueDeclarationsIn({
        source: `const seed = 1;\nexport { seed as away } from "./other.ts";`,
        relativePath: RELATIVE_PATH,
      }));

    it("leaves a name that only passes through a re-export unmarked", ({
      declarationsOfAConstantBesideAReExport,
    }) => {
      expect(declarationsOfAConstantBesideAReExport).toStrictEqual([
        {
          name: "seed",
          line: 1,
          exported: false,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
      ]);
    });
  });

  describe("a constant standing inside another declaration", () => {
    const it = test.extend("declarationsOfAConstantStandingInsideAnother", () =>
      valueDeclarationsIn({
        source: `export const outer = () => { const inner = 1; return inner; };`,
        relativePath: RELATIVE_PATH,
      }));

    it("reads a declaration standing inside another declaration", ({
      declarationsOfAConstantStandingInsideAnother,
    }) => {
      expect(declarationsOfAConstantStandingInsideAnother).toStrictEqual([
        {
          name: "outer",
          line: 1,
          exported: true,
          fingerprint: `{annotation:null,init:{type:"ArrowFunctionExpression",expression:false,async:false,typeParameters:null,params:[],returnType:null,body:{type:"BlockStatement",body:[{type:"VariableDeclaration",kind:"const",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",decorators:[],name:"$0",optional:false,typeAnnotation:null},init:{type:"Literal",value:1,raw:"1"},definite:false}],declare:false},{type:"ReturnStatement",argument:{type:"Identifier",decorators:[],name:"$0",optional:false,typeAnnotation:null}}]},id:null,generator:false}}`,
        },
        {
          name: "inner",
          line: 1,
          exported: false,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
      ]);
    });
  });

  describe("a constant shadowing the exported name it stands inside", () => {
    const it = test.extend("declarationsOfAConstantShadowingAnExportedName", () =>
      valueDeclarationsIn({
        source: `export const seed = () => { const seed = 1; return seed; };`,
        relativePath: RELATIVE_PATH,
      }));

    it("leaves a declaration standing inside another one unmarked as exported", ({
      declarationsOfAConstantShadowingAnExportedName,
    }) => {
      expect(declarationsOfAConstantShadowingAnExportedName).toStrictEqual([
        {
          name: "seed",
          line: 1,
          exported: true,
          fingerprint: `{annotation:null,init:{type:"ArrowFunctionExpression",expression:false,async:false,typeParameters:null,params:[],returnType:null,body:{type:"BlockStatement",body:[{type:"VariableDeclaration",kind:"const",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",decorators:[],name:"$0",optional:false,typeAnnotation:null},init:{type:"Literal",value:1,raw:"1"},definite:false}],declare:false},{type:"ReturnStatement",argument:{type:"Identifier",decorators:[],name:"$0",optional:false,typeAnnotation:null}}]},id:null,generator:false}}`,
        },
        {
          name: "seed",
          line: 1,
          exported: false,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
      ]);
    });
  });

  describe("a constant standing on the third line", () => {
    const it = test.extend("declarationsOfAConstantOnTheThirdLine", () =>
      valueDeclarationsIn({ source: `\n\nconst seed = 1;`, relativePath: RELATIVE_PATH }));

    it("reads the line the declaration stands on", ({ declarationsOfAConstantOnTheThirdLine }) => {
      expect(declarationsOfAConstantOnTheThirdLine).toStrictEqual([
        {
          name: "seed",
          line: 3,
          exported: false,
          fingerprint: `{annotation:null,init:{type:"Literal",value:1,raw:"1"}}`,
        },
      ]);
    });
  });

  describe("two readers reaching one import under different aliases", () => {
    const it = test
      .extend("declarationsOfAReaderNamingReadFileSync", () =>
        valueDeclarationsIn({
          source: `import { readFileSync } from "node:fs";\nexport const read = (path: string) => readFileSync(path, "utf8");`,
          relativePath: RELATIVE_PATH,
        }))
      .extend("declarationsOfAReaderAliasingReadFileSync", () =>
        valueDeclarationsIn({
          source: `import { readFileSync as slurp } from "node:fs";\nexport const read = (target: string) => slurp(target, "utf8");`,
          relativePath: "packages/two/src/read.ts",
        }),
      );

    it("gives two constants that differ only in the alias of one import the same fingerprint", ({
      declarationsOfAReaderNamingReadFileSync,
      declarationsOfAReaderAliasingReadFileSync,
    }) => {
      expect(declarationsOfAReaderNamingReadFileSync).toStrictEqual(
        declarationsOfAReaderAliasingReadFileSync,
      );
    });
  });
});
