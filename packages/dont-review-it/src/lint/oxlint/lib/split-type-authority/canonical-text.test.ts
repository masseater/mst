import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { canonicalTextOf, placeholdersIn, referencedTypeNamesIn } from "./canonical-text.ts";

describe("canonicalTextOf", () => {
  describe("members written in a different order", () => {
    const it = test
      .extend("canonicalTextInWrittenOrder", () => {
        const declared = parseSync(
          "source.ts",
          "export type Shape = { readonly a: string; readonly b: number };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextInReversedOrder", () => {
        const declared = parseSync(
          "source.ts",
          "export type Shape = { readonly b: number; readonly a: string };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("read as the same structure", ({
      canonicalTextInWrittenOrder,
      canonicalTextInReversedOrder,
    }) => {
      expect(canonicalTextInWrittenOrder).toBe(canonicalTextInReversedOrder);
    });
  });

  describe("union arms written in a different order", () => {
    const it = test
      .extend("canonicalTextInWrittenOrder", () => {
        const declared = parseSync("source.ts", `export type Mode = "read" | "write";`).program
          .body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextInReversedOrder", () => {
        const declared = parseSync("source.ts", `export type Mode = "write" | "read";`).program
          .body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("read as the same structure", ({
      canonicalTextInWrittenOrder,
      canonicalTextInReversedOrder,
    }) => {
      expect(canonicalTextInWrittenOrder).toBe(canonicalTextInReversedOrder);
    });
  });

  describe("intersection parts written in a different order", () => {
    const it = test
      .extend("canonicalTextInWrittenOrder", () => {
        const declared = parseSync("source.ts", "export type Both = Left & Right;").program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextInReversedOrder", () => {
        const declared = parseSync("source.ts", "export type Both = Right & Left;").program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("read as the same structure", ({
      canonicalTextInWrittenOrder,
      canonicalTextInReversedOrder,
    }) => {
      expect(canonicalTextInWrittenOrder).toBe(canonicalTextInReversedOrder);
    });
  });

  describe("a member carrying a marker", () => {
    const it = test
      .extend("canonicalTextOfAReadonlyMember", () => {
        const declared = parseSync("source.ts", "export type Shape = { readonly a: string };")
          .program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAnOptionalMember", () => {
        const declared = parseSync("source.ts", "export type Shape = { a?: string };").program
          .body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAPlainMember", () => {
        const declared = parseSync("source.ts", "export type Shape = { a: string };").program
          .body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("reads apart from the same member without the readonly marker", ({
      canonicalTextOfAReadonlyMember,
      canonicalTextOfAPlainMember,
    }) => {
      expect(canonicalTextOfAReadonlyMember).not.toBe(canonicalTextOfAPlainMember);
    });

    it("reads apart from the same member without the optional marker", ({
      canonicalTextOfAnOptionalMember,
      canonicalTextOfAPlainMember,
    }) => {
      expect(canonicalTextOfAnOptionalMember).not.toBe(canonicalTextOfAPlainMember);
    });
  });

  describe("type parameters renamed throughout", () => {
    const it = test
      .extend("canonicalTextOfAParameterSpelledT", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held<T> = { readonly held: T; readonly next: Held<T> };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAParameterSpelledU", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held<U> = { readonly held: U; readonly next: Held<U> };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("read as the same structure", ({
      canonicalTextOfAParameterSpelledT,
      canonicalTextOfAParameterSpelledU,
    }) => {
      expect(canonicalTextOfAParameterSpelledT).toBe(canonicalTextOfAParameterSpelledU);
    });
  });

  describe("a type parameter renamed inside a member signature", () => {
    const it = test
      .extend("canonicalTextOfAParameterSpelledT", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held = { readonly map: <T>(held: T) => T };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAParameterSpelledU", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held = { readonly map: <U>(held: U) => U };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("reads as the same structure", ({
      canonicalTextOfAParameterSpelledT,
      canonicalTextOfAParameterSpelledU,
    }) => {
      expect(canonicalTextOfAParameterSpelledT).toBe(canonicalTextOfAParameterSpelledU);
    });
  });

  describe("a type parameter constraint", () => {
    const it = test
      .extend("canonicalTextOfAParameterConstrainedToString", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held<T extends string> = { readonly held: T };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAParameterConstrainedToNumber", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held<T extends number> = { readonly held: T };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("is part of the structure", ({
      canonicalTextOfAParameterConstrainedToString,
      canonicalTextOfAParameterConstrainedToNumber,
    }) => {
      expect(canonicalTextOfAParameterConstrainedToString).not.toBe(
        canonicalTextOfAParameterConstrainedToNumber,
      );
    });
  });

  describe("a type parameter default", () => {
    const it = test
      .extend("canonicalTextOfAParameterDefaultedToString", () => {
        const declared = parseSync(
          "source.ts",
          "export type Held<T = string> = { readonly held: T };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAParameterCarryingNoDefault", () => {
        const declared = parseSync("source.ts", "export type Held<T> = { readonly held: T };")
          .program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("is part of the structure", ({
      canonicalTextOfAParameterDefaultedToString,
      canonicalTextOfAParameterCarryingNoDefault,
    }) => {
      expect(canonicalTextOfAParameterDefaultedToString).not.toBe(
        canonicalTextOfAParameterCarryingNoDefault,
      );
    });
  });

  describe("a reference to a named type", () => {
    const it = test
      .extend("canonicalTextOfAReferenceToNamed", () => {
        const declared = parseSync("source.ts", "export type Shape = { readonly a: Named };")
          .program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAReferenceToOther", () => {
        const declared = parseSync("source.ts", "export type Shape = { readonly a: Other };")
          .program.body[0];
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
      });

    it("keeps the name it refers to", ({
      canonicalTextOfAReferenceToNamed,
      canonicalTextOfAReferenceToOther,
    }) => {
      expect(canonicalTextOfAReferenceToNamed).not.toBe(canonicalTextOfAReferenceToOther);
    });

    it("reads apart from the same name reached through a namespace", ({
      canonicalTextOfAReferenceThroughHeld,
      canonicalTextOfAReferenceToNamed,
    }) => {
      expect(canonicalTextOfAReferenceThroughHeld).not.toBe(canonicalTextOfAReferenceToNamed);
    });

    it("reached through two different namespaces reads apart either way", ({
      canonicalTextOfAReferenceThroughHeld,
      canonicalTextOfAReferenceThroughOther,
    }) => {
      expect(canonicalTextOfAReferenceThroughHeld).not.toBe(canonicalTextOfAReferenceThroughOther);
    });
  });

  describe("type arguments carried by a reference", () => {
    const it = test
      .extend("canonicalTextOfAReferenceCarryingString", () => {
        const declared = parseSync(
          "source.ts",
          "export type Shape = { readonly a: Named<string> };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      })
      .extend("canonicalTextOfAReferenceCarryingNumber", () => {
        const declared = parseSync(
          "source.ts",
          "export type Shape = { readonly a: Named<number> };",
        ).program.body[0];
        return canonicalTextOf(declared, placeholdersIn(declared));
      });

    it("are part of the reference", ({
      canonicalTextOfAReferenceCarryingString,
      canonicalTextOfAReferenceCarryingNumber,
    }) => {
      expect(canonicalTextOfAReferenceCarryingString).not.toBe(
        canonicalTextOfAReferenceCarryingNumber,
      );
    });
  });
});

describe("placeholdersIn", () => {
  describe("a declaration taking two type parameters", () => {
    const it = test.extend("placeholderEntries", () => {
      const declared = parseSync(
        "source.ts",
        "export type Pair<Left, Right> = readonly [Left, Right];",
      ).program.body[0];
      return Array.from(placeholdersIn(declared).entries());
    });

    it("binds every declared type parameter to the position it was declared at", ({
      placeholderEntries,
    }) => {
      expect(placeholderEntries).toStrictEqual([
        ["Left", "#0"],
        ["Right", "#1"],
      ]);
    });
  });

  describe("a declaration taking no type parameter", () => {
    const it = test.extend("placeholders", () => {
      const declared = parseSync("source.ts", "export type Held = string;").program.body[0];
      return placeholdersIn(declared);
    });

    it("binds nothing", ({ placeholders }) => {
      expect(placeholders).toStrictEqual(new Map());
    });
  });
});

describe("referencedTypeNamesIn", () => {
  describe("a declaration naming three types", () => {
    const it = test.extend("referencedTypeNames", () => {
      const declared = parseSync(
        "source.ts",
        "export type Shape = { readonly a: Named; readonly b: Other<Third> };",
      ).program.body[0];
      return referencedTypeNamesIn(declared);
    });

    it("collects every bare name in the order it appears", ({ referencedTypeNames }) => {
      expect(referencedTypeNames).toStrictEqual(["Named", "Other", "Third"]);
    });
  });

  describe("a declaration reaching a name through a namespace", () => {
    const it = test.extend("referencedTypeNames", () => {
      const declared = parseSync("source.ts", "export type Shape = { readonly a: held.Named };")
        .program.body[0];
      return referencedTypeNamesIn(declared);
    });

    it("leaves that name out of the bare names", ({ referencedTypeNames }) => {
      expect(referencedTypeNames).toStrictEqual([]);
    });
  });
});
