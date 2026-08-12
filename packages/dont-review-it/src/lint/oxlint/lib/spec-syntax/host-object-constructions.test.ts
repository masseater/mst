import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  constructedHostTypeOf,
  hostObjectTypesFrom,
  runtimeModulesFrom,
} from "./host-object-constructions.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("hostTypeOfAConstructionOfARuntimeName", () => {
    const declared = parseSync("spec.ts", "const written = new Response('a');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAConstructionOfTheOtherRuntimeName", () => {
    const declared = parseSync("spec.ts", "const written = new Request('https://example.test/');")
      .program.body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAConstructionOfANameTheCallerDeclares", () => {
    const declared = parseSync("spec.ts", "const written = new Response('a');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: () => null,
      qualified: () => null,
    });
  })
  .extend("hostTypeOfAConstructionOfAnUnrelatedName", () => {
    const declared = parseSync("spec.ts", "const written = new Date(0);").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAConstructionReachedThroughARuntimeNamespace", () => {
    const declared = parseSync("spec.ts", "const written = new undici.Response('a');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAConstructionReachedThroughAnUnrelatedNamespace", () => {
    const declared = parseSync("spec.ts", "const written = new helpers.Response('a');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAConstructorReadOffANameAtRunTime", () => {
    const declared = parseSync("spec.ts", "const written = new globalThis[name]('a');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAConstructorHandedBackByACall", () => {
    const declared = parseSync("spec.ts", "const written = new (build())('a');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfTheJsonFactoryCall", () => {
    const declared = parseSync("spec.ts", "const written = Response.json({ id: 1 });").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfTheRedirectFactoryCall", () => {
    const declared = parseSync("spec.ts", "const written = Response.redirect('/next');").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfTheErrorFactoryCall", () => {
    const declared = parseSync("spec.ts", "const written = Response.error();").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAFactoryCallReachedThroughARuntimeNamespace", () => {
    const declared = parseSync("spec.ts", "const written = undici.Response.json({ id: 1 });")
      .program.body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAMethodThatIsNotOneOfTheStandardFactories", () => {
    const declared = parseSync("spec.ts", "const written = Response.clone();").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAFactoryCallOnAHostTypeThatHasNoFactory", () => {
    const declared = parseSync("spec.ts", "const written = Request.json({ id: 1 });").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAMethodNamedAtRunTime", () => {
    const declared = parseSync("spec.ts", "const written = Response[member]();").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAFactoryCallOnTheValueACallHandedBack", () => {
    const declared = parseSync("spec.ts", "const written = build().json({ id: 1 });").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfABareCallOnAName", () => {
    const declared = parseSync("spec.ts", "const written = read();").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfABareName", () => {
    const declared = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypeOfAnObjectWrittenOutInPlace", () => {
    const declared = parseSync("spec.ts", "const written = { status: 200 };").program
      .body[0] as ESTree.Statement;
    const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
    return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
      named: (name) => (name === "Request" || name === "Response" ? name : null),
      qualified: (namespace, member) =>
        namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
    });
  })
  .extend("hostTypesReadWithoutOptions", () => hostObjectTypesFrom([]))
  .extend("runtimeModulesReadWithoutOptions", () => runtimeModulesFrom([]))
  .extend("hostTypesReadFromASeverityAlone", () => hostObjectTypesFrom(["error"]))
  .extend("hostTypesReadFromASingleSpelling", () =>
    hostObjectTypesFrom([{ hostObjectTypes: "Response" }]),
  )
  .extend("hostTypesReadFromAnEmptyRoster", () => hostObjectTypesFrom([{ hostObjectTypes: [] }]))
  .extend("hostTypesReadFromARosterHoldingNoSpelling", () =>
    hostObjectTypesFrom([{ hostObjectTypes: [1] }]),
  )
  .extend("hostTypesReadFromASpelledOutRoster", () =>
    hostObjectTypesFrom([{ hostObjectTypes: ["Headers"] }]),
  )
  .extend("runtimeModulesReadFromASpelledOutList", () =>
    runtimeModulesFrom([{ runtimeModules: ["@internal/http"] }]),
  );

describe("host-object-constructions", () => {
  it("a construction of a name the runtime declares is that host type", ({
    hostTypeOfAConstructionOfARuntimeName,
  }) => {
    expect(hostTypeOfAConstructionOfARuntimeName).toBe("Response");
  });

  it("a construction of the other name the runtime declares is that host type too", ({
    hostTypeOfAConstructionOfTheOtherRuntimeName,
  }) => {
    expect(hostTypeOfAConstructionOfTheOtherRuntimeName).toBe("Request");
  });

  it("a construction of a name the caller declares is not a host type", ({
    hostTypeOfAConstructionOfANameTheCallerDeclares,
  }) => {
    expect(hostTypeOfAConstructionOfANameTheCallerDeclares).toBe(null);
  });

  it("a construction of an unrelated name is not a host type", ({
    hostTypeOfAConstructionOfAnUnrelatedName,
  }) => {
    expect(hostTypeOfAConstructionOfAnUnrelatedName).toBe(null);
  });

  it("a construction reached through a runtime namespace is that host type", ({
    hostTypeOfAConstructionReachedThroughARuntimeNamespace,
  }) => {
    expect(hostTypeOfAConstructionReachedThroughARuntimeNamespace).toBe("Response");
  });

  it("a construction reached through an unrelated namespace is not a host type", ({
    hostTypeOfAConstructionReachedThroughAnUnrelatedNamespace,
  }) => {
    expect(hostTypeOfAConstructionReachedThroughAnUnrelatedNamespace).toBe(null);
  });

  it("a constructor read off a name at run time is not a host type", ({
    hostTypeOfAConstructorReadOffANameAtRunTime,
  }) => {
    expect(hostTypeOfAConstructorReadOffANameAtRunTime).toBe(null);
  });

  it("a constructor handed back by a call is not a host type", ({
    hostTypeOfAConstructorHandedBackByACall,
  }) => {
    expect(hostTypeOfAConstructorHandedBackByACall).toBe(null);
  });

  it("the json factory hands back the same host type a construction does", ({
    hostTypeOfTheJsonFactoryCall,
  }) => {
    expect(hostTypeOfTheJsonFactoryCall).toBe("Response");
  });

  it("the redirect factory hands back the same host type a construction does", ({
    hostTypeOfTheRedirectFactoryCall,
  }) => {
    expect(hostTypeOfTheRedirectFactoryCall).toBe("Response");
  });

  it("the error factory hands back the same host type a construction does", ({
    hostTypeOfTheErrorFactoryCall,
  }) => {
    expect(hostTypeOfTheErrorFactoryCall).toBe("Response");
  });

  it("a factory reached through a runtime namespace hands back the same host type", ({
    hostTypeOfAFactoryCallReachedThroughARuntimeNamespace,
  }) => {
    expect(hostTypeOfAFactoryCallReachedThroughARuntimeNamespace).toBe("Response");
  });

  it("a method that is not one of the standard factories is not a construction", ({
    hostTypeOfAMethodThatIsNotOneOfTheStandardFactories,
  }) => {
    expect(hostTypeOfAMethodThatIsNotOneOfTheStandardFactories).toBe(null);
  });

  it("a host type the runtime gives no factory to has no factory call to read", ({
    hostTypeOfAFactoryCallOnAHostTypeThatHasNoFactory,
  }) => {
    expect(hostTypeOfAFactoryCallOnAHostTypeThatHasNoFactory).toBe(null);
  });

  it("a method named at run time is not a factory call", ({ hostTypeOfAMethodNamedAtRunTime }) => {
    expect(hostTypeOfAMethodNamedAtRunTime).toBe(null);
  });

  it("a factory call on the value a call handed back is not a factory call", ({
    hostTypeOfAFactoryCallOnTheValueACallHandedBack,
  }) => {
    expect(hostTypeOfAFactoryCallOnTheValueACallHandedBack).toBe(null);
  });

  it("a bare call on a name is not a factory call", ({ hostTypeOfABareCallOnAName }) => {
    expect(hostTypeOfABareCallOnAName).toBe(null);
  });

  it("a bare name is neither a construction nor a factory call", ({ hostTypeOfABareName }) => {
    expect(hostTypeOfABareName).toBe(null);
  });

  it("an object written out in place is neither a construction nor a factory call", ({
    hostTypeOfAnObjectWrittenOutInPlace,
  }) => {
    expect(hostTypeOfAnObjectWrittenOutInPlace).toBe(null);
  });

  it("the roster stands until the repository replaces it", ({ hostTypesReadWithoutOptions }) => {
    expect(hostTypesReadWithoutOptions).toStrictEqual(new Set(["Request", "Response"]));
  });

  it("the runtime module list stands until the repository replaces it", ({
    runtimeModulesReadWithoutOptions,
  }) => {
    expect(runtimeModulesReadWithoutOptions).toStrictEqual(new Set(["undici"]));
  });

  it("a rule run with a severity alone keeps the roster the rule carries", ({
    hostTypesReadFromASeverityAlone,
  }) => {
    expect(hostTypesReadFromASeverityAlone).toStrictEqual(new Set(["Request", "Response"]));
  });

  it("a roster written as a single spelling rather than a list keeps the carried roster", ({
    hostTypesReadFromASingleSpelling,
  }) => {
    expect(hostTypesReadFromASingleSpelling).toStrictEqual(new Set(["Request", "Response"]));
  });

  it("an empty roster keeps the carried roster", ({ hostTypesReadFromAnEmptyRoster }) => {
    expect(hostTypesReadFromAnEmptyRoster).toStrictEqual(new Set(["Request", "Response"]));
  });

  it("a roster holding nothing that reads as a spelling keeps the carried roster", ({
    hostTypesReadFromARosterHoldingNoSpelling,
  }) => {
    expect(hostTypesReadFromARosterHoldingNoSpelling).toStrictEqual(
      new Set(["Request", "Response"]),
    );
  });

  it("a repository that names its own roster is taken at its word", ({
    hostTypesReadFromASpelledOutRoster,
  }) => {
    expect(hostTypesReadFromASpelledOutRoster).toStrictEqual(new Set(["Headers"]));
  });

  it("a repository that names its own runtime modules is taken at its word", ({
    runtimeModulesReadFromASpelledOutList,
  }) => {
    expect(runtimeModulesReadFromASpelledOutList).toStrictEqual(new Set(["@internal/http"]));
  });
});
