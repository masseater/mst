import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { normalizedBodyOf } from "./normalized-body.ts";

import type { ImportRoutes } from "./import-routes.ts";

const NO_ROUTES: ImportRoutes = new Map();

describe("normalizedBodyOf", () => {
  describe("an arrow written a second way", () => {
    const it = test
      .extend("bodyOfArrowTakingStep", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (step) => step * 2;`).program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowTakingCount", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (count) => count * 2;`).program.body,
          routes: NO_ROUTES,
        }),
      )
      .extend("bodyOfArrowWrittenAcrossLines", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (\n  step,\n) =>\n  step * 2;`).program.body,
          routes: NO_ROUTES,
        }),
      );

    it("gives two bodies that differ only in a parameter name the same spelling", ({
      bodyOfArrowTakingStep,
      bodyOfArrowTakingCount,
    }) => {
      expect(bodyOfArrowTakingStep).toBe(bodyOfArrowTakingCount);
    });

    it("gives two bodies that differ only in formatting the same spelling", ({
      bodyOfArrowTakingStep,
      bodyOfArrowWrittenAcrossLines,
    }) => {
      expect(bodyOfArrowTakingStep).toBe(bodyOfArrowWrittenAcrossLines);
    });
  });

  describe("an arrow binding a local name", () => {
    const it = test
      .extend("bodyOfArrowBindingKept", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => { const kept = 1; return kept + kept; };`)
            .program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowBindingHeld", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => { const held = 1; return held + held; };`)
            .program.body,
          routes: NO_ROUTES,
        }),
      );

    it("gives two bodies that differ only in a local name the same spelling", ({
      bodyOfArrowBindingKept,
      bodyOfArrowBindingHeld,
    }) => {
      expect(bodyOfArrowBindingKept).toBe(bodyOfArrowBindingHeld);
    });
  });

  describe("an arrow reading a free name", () => {
    const it = test
      .extend("bodyOfArrowReadingReadFileSync", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => readFileSync("x");`).program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowReadingStatSync", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => statSync("x");`).program.body,
          routes: NO_ROUTES,
        }),
      );

    it("keeps two bodies apart when they read a different free name", ({
      bodyOfArrowReadingReadFileSync,
      bodyOfArrowReadingStatSync,
    }) => {
      expect(bodyOfArrowReadingReadFileSync).not.toBe(bodyOfArrowReadingStatSync);
    });
  });

  describe("an arrow reading an imported value", () => {
    const it = test
      .extend("bodyOfArrowReadingThroughRead", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => read("x");`).program.body,
          routes: new Map([["read", "node:fs#readFileSync"]]),
        }))
      .extend("bodyOfArrowReadingThroughSlurp", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => slurp("x");`).program.body,
          routes: new Map([["slurp", "node:fs#readFileSync"]]),
        }),
      )
      .extend("bodyOfArrowReadingThroughOwnModule", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = () => read("x");`).program.body,
          routes: new Map([["read", "./own#readFileSync"]]),
        }),
      );

    it("gives two bodies reading one imported value under different aliases the same spelling", ({
      bodyOfArrowReadingThroughRead,
      bodyOfArrowReadingThroughSlurp,
    }) => {
      expect(bodyOfArrowReadingThroughRead).toBe(bodyOfArrowReadingThroughSlurp);
    });

    it("keeps two bodies apart when their imported values come from different modules", ({
      bodyOfArrowReadingThroughRead,
      bodyOfArrowReadingThroughOwnModule,
    }) => {
      expect(bodyOfArrowReadingThroughRead).not.toBe(bodyOfArrowReadingThroughOwnModule);
    });
  });

  describe("an arrow building an object property", () => {
    const it = test
      .extend("bodyOfArrowWithShorthandProperty", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (id) => ({ id });`).program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowWithRenamedPropertyValue", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (held) => ({ id: held });`).program.body,
          routes: NO_ROUTES,
        }),
      )
      .extend("bodyOfArrowWithAnotherPropertyKey", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (id) => ({ seed: id });`).program.body,
          routes: NO_ROUTES,
        }),
      );

    it("keeps the written key of a property while renaming the value it holds", ({
      bodyOfArrowWithShorthandProperty,
      bodyOfArrowWithRenamedPropertyValue,
    }) => {
      expect(bodyOfArrowWithShorthandProperty).toBe(bodyOfArrowWithRenamedPropertyValue);
    });

    it("keeps two bodies apart when a property is written under a different key", ({
      bodyOfArrowWithShorthandProperty,
      bodyOfArrowWithAnotherPropertyKey,
    }) => {
      expect(bodyOfArrowWithShorthandProperty).not.toBe(bodyOfArrowWithAnotherPropertyKey);
    });
  });

  describe("an arrow writing a computed key", () => {
    const it = test
      .extend("bodyOfArrowWithComputedKeyOnId", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (id) => ({ [id]: 1 });`).program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowWithComputedKeyOnHeld", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (held) => ({ [held]: 1 });`).program.body,
          routes: NO_ROUTES,
        }),
      );

    it("renames a binding read through a computed key", ({
      bodyOfArrowWithComputedKeyOnId,
      bodyOfArrowWithComputedKeyOnHeld,
    }) => {
      expect(bodyOfArrowWithComputedKeyOnId).toBe(bodyOfArrowWithComputedKeyOnHeld);
    });
  });

  describe("an arrow reaching a member on a renamed binding", () => {
    const it = test
      .extend("bodyOfArrowReadingSize", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (held) => held.size;`).program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowReadingLength", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const run = (held) => held.length;`).program.body,
          routes: NO_ROUTES,
        }),
      );

    it("keeps the written name of a member reached on a renamed binding", ({
      bodyOfArrowReadingSize,
      bodyOfArrowReadingLength,
    }) => {
      expect(bodyOfArrowReadingSize).not.toBe(bodyOfArrowReadingLength);
    });
  });

  describe("an arrow carrying a literal", () => {
    const it = test
      .extend("bodyOfArrowReportingDraft", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const label = () => report("draft");`).program.body,
          routes: NO_ROUTES,
        }))
      .extend("bodyOfArrowReportingPublished", () =>
        normalizedBodyOf({
          body: parseSync("body.ts", `const label = () => report("published");`).program.body,
          routes: NO_ROUTES,
        }),
      );

    it("keeps two bodies apart when only a literal differs", ({
      bodyOfArrowReportingDraft,
      bodyOfArrowReportingPublished,
    }) => {
      expect(bodyOfArrowReportingDraft).not.toBe(bodyOfArrowReportingPublished);
    });
  });
});
