import { describe, expect, test } from "vite-plus/test";

import { freezeDeep } from "./freeze-deep.ts";

describe("freezeDeep", () => {
  describe("a nested graph with one shared object", () => {
    const sharedSymbol = Symbol("shared");

    const rootIt = test.extend("rootFrozen", () => {
      const shared = { label: "shared" };
      const frozenGraph = freezeDeep({ list: [shared], nested: { shared } });
      return Object.isFrozen(frozenGraph);
    });

    rootIt("freezes the root", ({ rootFrozen }) => {
      expect(rootFrozen).toBe(true);
    });

    const nestedIt = test.extend("nestedFrozen", () => {
      const shared = { label: "shared" };
      const frozenGraph = freezeDeep({ list: [shared], nested: { shared } });
      return Object.isFrozen(frozenGraph.nested);
    });

    nestedIt("freezes a nested object", ({ nestedFrozen }) => {
      expect(nestedFrozen).toBe(true);
    });

    const listIt = test.extend("listFrozen", () => {
      const shared = { label: "shared" };
      const frozenGraph = freezeDeep({ list: [shared], nested: { shared } });
      return Object.isFrozen(frozenGraph.list);
    });

    listIt("freezes a nested array", ({ listFrozen }) => {
      expect(listFrozen).toBe(true);
    });

    const accessorIt = test.extend("accessorOwnerFrozen", () => {
      const shared = { label: "shared" };
      const hidden = {
        [sharedSymbol]: shared,
        get unread(): never {
          throw new Error("an accessor must not run while its owner is frozen");
        },
      };
      const frozenGraph = freezeDeep({ hidden });
      return Object.isFrozen(frozenGraph.hidden);
    });

    accessorIt("freezes an object with an accessor without invoking it", ({ accessorOwnerFrozen }) => {
      expect(accessorOwnerFrozen).toBe(true);
    });

    const symbolIt = test.extend("symbolValueFrozen", () => {
      const shared = { label: "shared" };
      const frozenGraph = freezeDeep({ hidden: { [sharedSymbol]: shared } });
      return Object.isFrozen(frozenGraph.hidden[sharedSymbol]);
    });

    symbolIt("freezes a value held by a symbol property", ({ symbolValueFrozen }) => {
      expect(symbolValueFrozen).toBe(true);
    });

    const identityIt = test.extend("sharedIdentityPreserved", () => {
      const shared = { label: "shared" };
      const frozenGraph = freezeDeep({ list: [shared], nested: { shared } });
      return frozenGraph.list[0] === frozenGraph.nested.shared;
    });

    identityIt("preserves shared identity", ({ sharedIdentityPreserved }) => {
      expect(sharedIdentityPreserved).toBe(true);
    });
  });

  describe("a function whose non-enumerable prototype points back to it", () => {
    const functionIt = test.extend("functionFrozen", () => {
      const cyclicFunction = function cyclicFunction(): string {
        return "cycle";
      };
      return Object.isFrozen(freezeDeep(cyclicFunction));
    });

    functionIt("freezes the function without recursing forever", ({ functionFrozen }) => {
      expect(functionFrozen).toBe(true);
    });

    const prototypeIt = test.extend("prototypeFrozen", () => {
      const cyclicFunction = function cyclicFunction(): string {
        return "cycle";
      };
      const frozenCycle = freezeDeep(cyclicFunction);
      return Object.isFrozen(frozenCycle.prototype);
    });

    prototypeIt("freezes the non-enumerable prototype value", ({ prototypeFrozen }) => {
      expect(prototypeFrozen).toBe(true);
    });
  });
});
