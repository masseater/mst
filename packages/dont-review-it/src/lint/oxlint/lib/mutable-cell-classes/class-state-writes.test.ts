import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { stateFieldsWrittenAfterConstruction } from "./class-state-writes.ts";

const it = test
  .extend("fieldsOfAMethodThatAddsToAField", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Tally { total = 0; add(row: number) { this.total += row; } }")
        .program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfASetterThatOverwritesAField", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { set seed(next: string) { this.stored = next; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatCountsAFieldUp", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Tick { count = 0; bump() { this.count++; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatDropsAKeyOffTheInstance", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { drop() { delete this.spare; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesThroughAField", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Nest { seen = {}; mark() { this.seen.at = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesAKeySpelledAsAString", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", 'class Held { mark() { this["seen"] = 1; } }').program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesAKeySpelledInATemplate", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { mark() { this[`seen`] = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesAKeyDecidedWhileItRuns", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { mark(key: string) { this[key] = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesAKeySpelledInATemplateHoldingAValue", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { mark(key: string) { this[`at${key}`] = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesANumberKey", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { mark() { this[0] = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAClassSettledByItsConstructorAlone", () => {
    const program = astFieldsOf(
      parseSync(
        "cell.ts",
        "class Settled { seed: string; constructor(seed: string) { this.seed = seed; } }",
      ).program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAHandlerTheConstructorParksOnTheInstance", () => {
    const program = astFieldsOf(
      parseSync(
        "cell.ts",
        "class Late { count = 0; constructor() { this.bump = () => { this.count += 1; }; } }",
      ).program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAFieldHoldingAFunctionThatWrites", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Late { count = 0; bump = () => { this.count += 1; }; }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAFieldHoldingAFunctionOfItsOwnThis", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { count = 0; bump = function () { this.count += 1; }; }")
        .program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAFieldWrittenStraightThroughTheInitializer", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { seen = (this.count = 1); }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodHoldingAFunctionOfItsOwnThis", () => {
    const program = astFieldsOf(
      parseSync(
        "cell.ts",
        "class Held { mark() { const run = function () { this.count = 1; }; return run; } }",
      ).program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAClassThatKeepsItsStateOnTheClassItself", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { static made = 0; static bump() { this.made += 1; } }")
        .program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfABlockThatRunsWhenTheClassIsDefined", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { static { this.made = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesToSomethingOtherThanTheInstance", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { mark(sink: { at: number }) { sink.at = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatOnlyReadsTheInstance", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { seen = 0; read() { return this.seen; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatNegatesAValue", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { read() { return !this.seen; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesThroughAnAssertion", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { mark() { (this as Held).seen = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAMethodThatWritesAKeyKeptPrivateToTheClass", () => {
    const program = astFieldsOf(
      parseSync("cell.ts", "class Held { #count = 0; mark() { this.#count = 1; } }").program,
    );
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfAClassThatDeclaresNoMember", () => {
    const program = astFieldsOf(parseSync("cell.ts", "class Empty {}").program);
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  })
  .extend("fieldsOfADeclarationThatIsNotAClass", () => {
    const program = astFieldsOf(parseSync("cell.ts", "const held = 1;").program);
    if (program === null) throw new Error("the source was not parsed");
    const [declared] = statementsOf(program);
    if (declared === undefined) throw new Error("the source declares nothing");
    return stateFieldsWrittenAfterConstruction(declared);
  });

describe("stateFieldsWrittenAfterConstruction", () => {
  it("a method that adds to a field names that field", ({ fieldsOfAMethodThatAddsToAField }) => {
    expect(fieldsOfAMethodThatAddsToAField).toStrictEqual(new Set(["total"]));
  });

  it("a setter that overwrites a field names that field", ({
    fieldsOfASetterThatOverwritesAField,
  }) => {
    expect(fieldsOfASetterThatOverwritesAField).toStrictEqual(new Set(["stored"]));
  });

  it("a method that counts a field up names that field", ({
    fieldsOfAMethodThatCountsAFieldUp,
  }) => {
    expect(fieldsOfAMethodThatCountsAFieldUp).toStrictEqual(new Set(["count"]));
  });

  it("a method that drops a key off the instance names that key", ({
    fieldsOfAMethodThatDropsAKeyOffTheInstance,
  }) => {
    expect(fieldsOfAMethodThatDropsAKeyOffTheInstance).toStrictEqual(new Set(["spare"]));
  });

  it("a method that writes through a field names the field it reaches through", ({
    fieldsOfAMethodThatWritesThroughAField,
  }) => {
    expect(fieldsOfAMethodThatWritesThroughAField).toStrictEqual(new Set(["seen"]));
  });

  it("a method that writes a key spelled as a string names that key", ({
    fieldsOfAMethodThatWritesAKeySpelledAsAString,
  }) => {
    expect(fieldsOfAMethodThatWritesAKeySpelledAsAString).toStrictEqual(new Set(["seen"]));
  });

  it("a method that writes a key spelled in a template names that key", ({
    fieldsOfAMethodThatWritesAKeySpelledInATemplate,
  }) => {
    expect(fieldsOfAMethodThatWritesAKeySpelledInATemplate).toStrictEqual(new Set(["seen"]));
  });

  it("a method that writes a key decided while it runs names no field", ({
    fieldsOfAMethodThatWritesAKeyDecidedWhileItRuns,
  }) => {
    expect(fieldsOfAMethodThatWritesAKeyDecidedWhileItRuns).toStrictEqual(new Set());
  });

  it("a method that writes a key spelled in a template holding a value names no field", ({
    fieldsOfAMethodThatWritesAKeySpelledInATemplateHoldingAValue,
  }) => {
    expect(fieldsOfAMethodThatWritesAKeySpelledInATemplateHoldingAValue).toStrictEqual(new Set());
  });

  it("a method that writes a number key names no field", ({
    fieldsOfAMethodThatWritesANumberKey,
  }) => {
    expect(fieldsOfAMethodThatWritesANumberKey).toStrictEqual(new Set());
  });

  it("a class settled by its constructor alone names no field", ({
    fieldsOfAClassSettledByItsConstructorAlone,
  }) => {
    expect(fieldsOfAClassSettledByItsConstructorAlone).toStrictEqual(new Set());
  });

  it("a handler the constructor parks on the instance names the field it later writes", ({
    fieldsOfAHandlerTheConstructorParksOnTheInstance,
  }) => {
    expect(fieldsOfAHandlerTheConstructorParksOnTheInstance).toStrictEqual(new Set(["count"]));
  });

  it("a field holding a function that writes names that field", ({
    fieldsOfAFieldHoldingAFunctionThatWrites,
  }) => {
    expect(fieldsOfAFieldHoldingAFunctionThatWrites).toStrictEqual(new Set(["count"]));
  });

  it("a field holding a function of its own this names no field", ({
    fieldsOfAFieldHoldingAFunctionOfItsOwnThis,
  }) => {
    expect(fieldsOfAFieldHoldingAFunctionOfItsOwnThis).toStrictEqual(new Set());
  });

  it("a field written straight through the initializer names no field", ({
    fieldsOfAFieldWrittenStraightThroughTheInitializer,
  }) => {
    expect(fieldsOfAFieldWrittenStraightThroughTheInitializer).toStrictEqual(new Set());
  });

  it("a method holding a function of its own this names no field", ({
    fieldsOfAMethodHoldingAFunctionOfItsOwnThis,
  }) => {
    expect(fieldsOfAMethodHoldingAFunctionOfItsOwnThis).toStrictEqual(new Set());
  });

  it("a class that keeps its state on the class itself names no field", ({
    fieldsOfAClassThatKeepsItsStateOnTheClassItself,
  }) => {
    expect(fieldsOfAClassThatKeepsItsStateOnTheClassItself).toStrictEqual(new Set());
  });

  it("a block that runs when the class is defined names no field", ({
    fieldsOfABlockThatRunsWhenTheClassIsDefined,
  }) => {
    expect(fieldsOfABlockThatRunsWhenTheClassIsDefined).toStrictEqual(new Set());
  });

  it("a method that writes to something other than the instance names no field", ({
    fieldsOfAMethodThatWritesToSomethingOtherThanTheInstance,
  }) => {
    expect(fieldsOfAMethodThatWritesToSomethingOtherThanTheInstance).toStrictEqual(new Set());
  });

  it("a method that only reads the instance names no field", ({
    fieldsOfAMethodThatOnlyReadsTheInstance,
  }) => {
    expect(fieldsOfAMethodThatOnlyReadsTheInstance).toStrictEqual(new Set());
  });

  it("a method that negates a value names no field", ({ fieldsOfAMethodThatNegatesAValue }) => {
    expect(fieldsOfAMethodThatNegatesAValue).toStrictEqual(new Set());
  });

  it("a method that writes through an assertion names the asserted field", ({
    fieldsOfAMethodThatWritesThroughAnAssertion,
  }) => {
    expect(fieldsOfAMethodThatWritesThroughAnAssertion).toStrictEqual(new Set(["seen"]));
  });

  it("a method that writes a key kept private to the class names that key", ({
    fieldsOfAMethodThatWritesAKeyKeptPrivateToTheClass,
  }) => {
    expect(fieldsOfAMethodThatWritesAKeyKeptPrivateToTheClass).toStrictEqual(new Set(["#count"]));
  });

  it("a class that declares no member names no field", ({ fieldsOfAClassThatDeclaresNoMember }) => {
    expect(fieldsOfAClassThatDeclaresNoMember).toStrictEqual(new Set());
  });

  it("a declaration that is not a class names no field", ({
    fieldsOfADeclarationThatIsNotAClass,
  }) => {
    expect(fieldsOfADeclarationThatIsNotAClass).toStrictEqual(new Set());
  });
});
