import { describe, expect, test } from "vite-plus/test";

import {
  deadWithdrawals,
  declaredReplacementsIn,
  DEFAULT_DECLARED_REPLACEMENTS,
  groundlessWithdrawals,
  replacementNamed,
  replacementsInForce,
  withdrawalsIn,
} from "./declared-entries.ts";

const RETIRED_LERNA = { name: "lerna", substitute: "Run the workspace task runner." };

describe("DEFAULT_DECLARED_REPLACEMENTS", () => {
  describe("the shared list before anyone declares an entry", () => {
    const it = test.extend("standingReplacements", () => DEFAULT_DECLARED_REPLACEMENTS);

    it("starts out carrying no entry", ({ standingReplacements }) => {
      expect(standingReplacements).toStrictEqual([]);
    });
  });
});

describe("declaredReplacementsIn", () => {
  describe("an entry the consumer declares", () => {
    const it = test.extend("replacements", () =>
      declaredReplacementsIn({
        options: [{ declared: [{ name: "gulp", substitute: "Run the workspace task runner." }] }],
        standing: [RETIRED_LERNA],
      }));

    it("is added to what already stands", ({ replacements }) => {
      expect(replacements).toStrictEqual([
        RETIRED_LERNA,
        { name: "gulp", substitute: "Run the workspace task runner." },
      ]);
    });
  });

  describe("an entry written without a name", () => {
    const it = test.extend("replacements", () =>
      declaredReplacementsIn({ options: [{ declared: [{ substitute: "x" }] }], standing: [] }));

    it("is left out", ({ replacements }) => {
      expect(replacements).toStrictEqual([]);
    });
  });

  describe("an entry written with an empty name", () => {
    const it = test.extend("replacements", () =>
      declaredReplacementsIn({
        options: [{ declared: [{ name: "", substitute: "x" }] }],
        standing: [],
      }));

    it("is left out", ({ replacements }) => {
      expect(replacements).toStrictEqual([]);
    });
  });

  describe("an entry written without a substitute", () => {
    const it = test.extend("replacements", () =>
      declaredReplacementsIn({ options: [{ declared: [{ name: "lerna" }] }], standing: [] }));

    it("is left out", ({ replacements }) => {
      expect(replacements).toStrictEqual([]);
    });
  });
});

describe("withdrawalsIn", () => {
  describe("a withdrawal written without a name", () => {
    const it = test.extend("withdrawals", () =>
      withdrawalsIn([{ withdrawn: [{ grounds: "the runner is not published" }] }]));

    it("is left out", ({ withdrawals }) => {
      expect(withdrawals).toStrictEqual([]);
    });
  });

  describe("a withdrawal written without grounds", () => {
    const it = test.extend("withdrawals", () =>
      withdrawalsIn([{ withdrawn: [{ name: "lerna" }] }]));

    it("carries none", ({ withdrawals }) => {
      expect(withdrawals).toStrictEqual([{ name: "lerna", grounds: "" }]);
    });
  });

  describe("grounds written as blank space", () => {
    const it = test.extend("withdrawals", () =>
      withdrawalsIn([{ withdrawn: [{ name: "lerna", grounds: "  " }] }]));

    it("carry none", ({ withdrawals }) => {
      expect(withdrawals).toStrictEqual([{ name: "lerna", grounds: "" }]);
    });
  });
});

describe("replacementsInForce", () => {
  describe("a withdrawal carrying grounds", () => {
    const it = test.extend("replacements", () =>
      replacementsInForce({
        declared: [RETIRED_LERNA],
        withdrawals: [{ name: "lerna", grounds: "the release job runs it" }],
      }));

    it("lifts the entry it names", ({ replacements }) => {
      expect(replacements).toStrictEqual([]);
    });
  });

  describe("a withdrawal carrying no grounds", () => {
    const it = test.extend("replacements", () =>
      replacementsInForce({
        declared: [RETIRED_LERNA],
        withdrawals: [{ name: "lerna", grounds: "" }],
      }));

    it("lifts nothing", ({ replacements }) => {
      expect(replacements).toStrictEqual([RETIRED_LERNA]);
    });
  });
});

describe("groundlessWithdrawals", () => {
  describe("two withdrawals, one of them carrying no grounds", () => {
    const it = test.extend("groundless", () =>
      groundlessWithdrawals([
        { name: "lerna", grounds: "" },
        { name: "gulp", grounds: "the release job runs it" },
      ]));

    it("comes back carrying the one written without grounds", ({ groundless }) => {
      expect(groundless).toStrictEqual([{ name: "lerna", grounds: "" }]);
    });
  });
});

describe("deadWithdrawals", () => {
  describe("two withdrawals, one of them naming what no entry declares", () => {
    const it = test.extend("dead", () =>
      deadWithdrawals({
        declared: [RETIRED_LERNA],
        withdrawals: [
          { name: "lerna", grounds: "the release job runs it" },
          { name: "gulp", grounds: "the release job runs it" },
        ],
      }));

    it("comes back carrying the one nothing declares", ({ dead }) => {
      expect(dead).toStrictEqual([{ name: "gulp", grounds: "the release job runs it" }]);
    });
  });
});

describe("replacementNamed", () => {
  describe("a name the list carries", () => {
    const it = test.extend("replacement", () =>
      replacementNamed({ entries: [RETIRED_LERNA], name: "lerna" }));

    it("comes back with its substitute", ({ replacement }) => {
      expect(replacement).toStrictEqual(RETIRED_LERNA);
    });
  });

  describe("a name the list does not carry", () => {
    const it = test.extend("replacement", () =>
      replacementNamed({ entries: [RETIRED_LERNA], name: "gulp" }));

    it("comes back as nothing", ({ replacement }) => {
      expect(replacement).toBe(null);
    });
  });
});
