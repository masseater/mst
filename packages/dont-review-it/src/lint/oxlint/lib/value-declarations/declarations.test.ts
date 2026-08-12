import { describe, expect, test } from "vite-plus/test";

import { valueDeclarationsIn } from "./declarations.ts";

const RELATIVE_PATH = "packages/one/src/read.ts";

const it = test
  .extend("declarationsOfAConstant", () =>
    valueDeclarationsIn({ source: `const seed = 1;`, relativePath: RELATIVE_PATH }))
  .extend("declarationsOfAConstantHoldingTwo", () =>
    valueDeclarationsIn({ source: `const seed = 2;`, relativePath: RELATIVE_PATH }),
  )
  .extend("declarationsOfAFunction", () =>
    valueDeclarationsIn({
      source: `function run(step: number) { return step; }`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAClass", () =>
    valueDeclarationsIn({ source: `class Owner {}`, relativePath: RELATIVE_PATH }),
  )
  .extend("declarationsOfATypeAlias", () =>
    valueDeclarationsIn({
      source: `export type Held = { readonly id: string };`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfABindingSpreadingIntoSeveralNames", () =>
    valueDeclarationsIn({
      source: `const { first, second } = split();`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfADefaultExport", () =>
    valueDeclarationsIn({ source: `export default 3;`, relativePath: RELATIVE_PATH }),
  )
  .extend("declarationsOfAConstantExportedWhereItStands", () =>
    valueDeclarationsIn({
      source: `export const seed = 1;\nconst kept = 2;`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAConstantSentAwayLater", () =>
    valueDeclarationsIn({
      source: `const seed = 1;\nexport { seed };`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAConstantBesideAReExport", () =>
    valueDeclarationsIn({
      source: `const seed = 1;\nexport { seed as away } from "./other.ts";`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAConstantStandingInsideAnother", () =>
    valueDeclarationsIn({
      source: `export const outer = () => { const inner = 1; return inner; };`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAConstantShadowingAnExportedName", () =>
    valueDeclarationsIn({
      source: `export const seed = () => { const seed = 1; return seed; };`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAConstantOnTheThirdLine", () =>
    valueDeclarationsIn({ source: `\n\nconst seed = 1;`, relativePath: RELATIVE_PATH }),
  )
  .extend("declarationsOfAReaderNamingReadFileSync", () =>
    valueDeclarationsIn({
      source: `import { readFileSync } from "node:fs";\nexport const read = (path: string) => readFileSync(path, "utf8");`,
      relativePath: RELATIVE_PATH,
    }),
  )
  .extend("declarationsOfAReaderAliasingReadFileSync", () =>
    valueDeclarationsIn({
      source: `import { readFileSync as slurp } from "node:fs";\nexport const read = (target: string) => slurp(target, "utf8");`,
      relativePath: "packages/two/src/read.ts",
    }),
  );

describe("valueDeclarationsIn", () => {
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

  it("leaves a type declaration out", ({ declarationsOfATypeAlias }) => {
    expect(declarationsOfATypeAlias).toStrictEqual([]);
  });

  it("leaves a binding that spreads into several names out", ({
    declarationsOfABindingSpreadingIntoSeveralNames,
  }) => {
    expect(declarationsOfABindingSpreadingIntoSeveralNames).toStrictEqual([]);
  });

  it("leaves a default export out", ({ declarationsOfADefaultExport }) => {
    expect(declarationsOfADefaultExport).toStrictEqual([]);
  });

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

  it("gives two constants that differ only in the alias of one import the same fingerprint", ({
    declarationsOfAReaderNamingReadFileSync,
    declarationsOfAReaderAliasingReadFileSync,
  }) => {
    expect(declarationsOfAReaderNamingReadFileSync).toStrictEqual(
      declarationsOfAReaderAliasingReadFileSync,
    );
  });

  it("keeps two constants apart when their bodies hold different values", ({
    declarationsOfAConstant,
    declarationsOfAConstantHoldingTwo,
  }) => {
    expect(declarationsOfAConstant).not.toStrictEqual(declarationsOfAConstantHoldingTwo);
  });
});
