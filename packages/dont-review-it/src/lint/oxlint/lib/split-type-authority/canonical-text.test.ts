import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { canonicalTextOf, placeholdersIn, referencedTypeNamesIn } from "./canonical-text.ts";

const it = test
  .extend("canonicalTextOfMembersInWrittenOrder", () => {
    const declared = parseSync(
      "source.ts",
      "export type Shape = { readonly a: string; readonly b: number };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfMembersInReversedOrder", () => {
    const declared = parseSync(
      "source.ts",
      "export type Shape = { readonly b: number; readonly a: string };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfUnionArmsInWrittenOrder", () => {
    const declared = parseSync("source.ts", `export type Mode = "read" | "write";`).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfUnionArmsInReversedOrder", () => {
    const declared = parseSync("source.ts", `export type Mode = "write" | "read";`).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfIntersectionPartsInWrittenOrder", () => {
    const declared = parseSync("source.ts", "export type Both = Left & Right;").program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfIntersectionPartsInReversedOrder", () => {
    const declared = parseSync("source.ts", "export type Both = Right & Left;").program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReadonlyMember", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: string };").program
      .body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAPlainMember", () => {
    const declared = parseSync("source.ts", "export type Shape = { a: string };").program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAnOptionalMember", () => {
    const declared = parseSync("source.ts", "export type Shape = { a?: string };").program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfATypeParameterSpelledT", () => {
    const declared = parseSync(
      "source.ts",
      "export type Held<T> = { readonly held: T; readonly next: Held<T> };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfATypeParameterSpelledU", () => {
    const declared = parseSync(
      "source.ts",
      "export type Held<U> = { readonly held: U; readonly next: Held<U> };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAMemberSignatureParameterSpelledT", () => {
    const declared = parseSync(
      "source.ts",
      "export type Held = { readonly map: <T>(held: T) => T };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAMemberSignatureParameterSpelledU", () => {
    const declared = parseSync(
      "source.ts",
      "export type Held = { readonly map: <U>(held: U) => U };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfATypeParameterConstrainedToString", () => {
    const declared = parseSync(
      "source.ts",
      "export type Held<T extends string> = { readonly held: T };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfATypeParameterConstrainedToNumber", () => {
    const declared = parseSync(
      "source.ts",
      "export type Held<T extends number> = { readonly held: T };",
    ).program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfATypeParameterDefaultedToString", () => {
    const declared = parseSync("source.ts", "export type Held<T = string> = { readonly held: T };")
      .program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfATypeParameterCarryingNoDefault", () => {
    const declared = parseSync("source.ts", "export type Held<T> = { readonly held: T };").program
      .body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReferenceToNamed", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: Named };").program
      .body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReferenceToOther", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: Other };").program
      .body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReferenceThroughHeld", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: held.Named };")
      .program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReferenceThroughOther", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: other.Named };")
      .program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReferenceCarryingString", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: Named<string> };")
      .program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("canonicalTextOfAReferenceCarryingNumber", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: Named<number> };")
      .program.body[0];
    return canonicalTextOf(declared, placeholdersIn(declared));
  })
  .extend("placeholderEntriesOfADeclarationTakingTwoTypeParameters", () => {
    const declared = parseSync(
      "source.ts",
      "export type Pair<Left, Right> = readonly [Left, Right];",
    ).program.body[0];
    return Array.from(placeholdersIn(declared).entries());
  })
  .extend("placeholdersOfADeclarationTakingNoTypeParameter", () => {
    const declared = parseSync("source.ts", "export type Held = string;").program.body[0];
    return placeholdersIn(declared);
  })
  .extend("referencedTypeNamesOfADeclarationNamingThree", () => {
    const declared = parseSync(
      "source.ts",
      "export type Shape = { readonly a: Named; readonly b: Other<Third> };",
    ).program.body[0];
    return referencedTypeNamesIn(declared);
  })
  .extend("referencedTypeNamesOfADeclarationReachingThroughANamespace", () => {
    const declared = parseSync("source.ts", "export type Shape = { readonly a: held.Named };")
      .program.body[0];
    return referencedTypeNamesIn(declared);
  });

describe("canonicalTextOf", () => {
  it("members written in a different order read as the same structure", ({
    canonicalTextOfMembersInWrittenOrder,
    canonicalTextOfMembersInReversedOrder,
  }) => {
    expect(canonicalTextOfMembersInWrittenOrder).toBe(canonicalTextOfMembersInReversedOrder);
  });

  it("union arms written in a different order read as the same structure", ({
    canonicalTextOfUnionArmsInWrittenOrder,
    canonicalTextOfUnionArmsInReversedOrder,
  }) => {
    expect(canonicalTextOfUnionArmsInWrittenOrder).toBe(canonicalTextOfUnionArmsInReversedOrder);
  });

  it("intersection parts written in a different order read as the same structure", ({
    canonicalTextOfIntersectionPartsInWrittenOrder,
    canonicalTextOfIntersectionPartsInReversedOrder,
  }) => {
    expect(canonicalTextOfIntersectionPartsInWrittenOrder).toBe(
      canonicalTextOfIntersectionPartsInReversedOrder,
    );
  });

  it("a member marked readonly reads apart from the same member without it", ({
    canonicalTextOfAReadonlyMember,
    canonicalTextOfAPlainMember,
  }) => {
    expect(canonicalTextOfAReadonlyMember).not.toBe(canonicalTextOfAPlainMember);
  });

  it("a member marked optional reads apart from the same member without it", ({
    canonicalTextOfAnOptionalMember,
    canonicalTextOfAPlainMember,
  }) => {
    expect(canonicalTextOfAnOptionalMember).not.toBe(canonicalTextOfAPlainMember);
  });

  it("type parameters renamed throughout read as the same structure", ({
    canonicalTextOfATypeParameterSpelledT,
    canonicalTextOfATypeParameterSpelledU,
  }) => {
    expect(canonicalTextOfATypeParameterSpelledT).toBe(canonicalTextOfATypeParameterSpelledU);
  });

  it("a type parameter renamed inside a member signature reads as the same structure", ({
    canonicalTextOfAMemberSignatureParameterSpelledT,
    canonicalTextOfAMemberSignatureParameterSpelledU,
  }) => {
    expect(canonicalTextOfAMemberSignatureParameterSpelledT).toBe(
      canonicalTextOfAMemberSignatureParameterSpelledU,
    );
  });

  it("a type parameter constraint is part of the structure", ({
    canonicalTextOfATypeParameterConstrainedToString,
    canonicalTextOfATypeParameterConstrainedToNumber,
  }) => {
    expect(canonicalTextOfATypeParameterConstrainedToString).not.toBe(
      canonicalTextOfATypeParameterConstrainedToNumber,
    );
  });

  it("a type parameter default is part of the structure", ({
    canonicalTextOfATypeParameterDefaultedToString,
    canonicalTextOfATypeParameterCarryingNoDefault,
  }) => {
    expect(canonicalTextOfATypeParameterDefaultedToString).not.toBe(
      canonicalTextOfATypeParameterCarryingNoDefault,
    );
  });

  it("a reference to a named type keeps the name it refers to", ({
    canonicalTextOfAReferenceToNamed,
    canonicalTextOfAReferenceToOther,
  }) => {
    expect(canonicalTextOfAReferenceToNamed).not.toBe(canonicalTextOfAReferenceToOther);
  });

  it("a reference through a namespace reads apart from a bare reference to the same name", ({
    canonicalTextOfAReferenceThroughHeld,
    canonicalTextOfAReferenceToNamed,
  }) => {
    expect(canonicalTextOfAReferenceThroughHeld).not.toBe(canonicalTextOfAReferenceToNamed);
  });

  it("references through two different namespaces read apart from each other", ({
    canonicalTextOfAReferenceThroughHeld,
    canonicalTextOfAReferenceThroughOther,
  }) => {
    expect(canonicalTextOfAReferenceThroughHeld).not.toBe(canonicalTextOfAReferenceThroughOther);
  });

  it("type arguments are part of a reference", ({
    canonicalTextOfAReferenceCarryingString,
    canonicalTextOfAReferenceCarryingNumber,
  }) => {
    expect(canonicalTextOfAReferenceCarryingString).not.toBe(
      canonicalTextOfAReferenceCarryingNumber,
    );
  });
});

describe("placeholdersIn", () => {
  it("every declared type parameter is bound to the position it was declared at", ({
    placeholderEntriesOfADeclarationTakingTwoTypeParameters,
  }) => {
    expect(placeholderEntriesOfADeclarationTakingTwoTypeParameters).toStrictEqual([
      ["Left", "#0"],
      ["Right", "#1"],
    ]);
  });

  it("a declaration without type parameters binds nothing", ({
    placeholdersOfADeclarationTakingNoTypeParameter,
  }) => {
    expect(placeholdersOfADeclarationTakingNoTypeParameter).toStrictEqual(new Map());
  });
});

describe("referencedTypeNamesIn", () => {
  it("every bare name a declaration refers to is collected in the order it appears", ({
    referencedTypeNamesOfADeclarationNamingThree,
  }) => {
    expect(referencedTypeNamesOfADeclarationNamingThree).toStrictEqual(["Named", "Other", "Third"]);
  });

  it("a name reached through a namespace is not collected as a bare name", ({
    referencedTypeNamesOfADeclarationReachingThroughANamespace,
  }) => {
    expect(referencedTypeNamesOfADeclarationReachingThroughANamespace).toStrictEqual([]);
  });
});
