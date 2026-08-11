import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noReceiverMutation } from "./no-receiver-mutation--derive-new-value.ts";

describe("dont-review-it/no-receiver-mutation--derive-new-value", () => {
  testLintRule(noReceiverMutation, {
    valid: [
      {
        name: "reading an entry out of an associative collection leaves it as it was",
        code: "const counts = new Map<string, number>();\ncounts.get('a');",
      },
      {
        name: "asking a set whether it holds a member leaves it as it was",
        code: "const seen = new Set<string>();\nseen.has('a');",
      },
      {
        name: "reading a moment leaves it as it was",
        code: "const stamp = new Date();\nstamp.getTime();",
      },
      {
        name: "a writing method name on a type outside the enumeration is another operation",
        code: "const store = new CookieStore();\nstore.set('a', 'b');",
      },
      {
        name: "a receiver whose type is nowhere to be read is left alone",
        code: "client.set('a', 1);",
      },
      {
        name: "a method of one's own class that leaves the instance as it was",
        code: "class Registry {\n  set(name: string) {\n    return name;\n  }\n}\nconst registry = new Registry();\nregistry.set('a');",
      },
      {
        name: "a constructor writing to this is the class settling its own state",
        code: "class Counter {\n  total: number;\n  constructor(total: number) {\n    this.total = total;\n  }\n}\nconst counter = new Counter(1);\nconsole.log(counter.total);",
      },
      {
        name: "an array receiver belongs to the rule that watches arrays",
        code: "const items: Array<string> = [];\nitems.push('a');",
      },
      {
        name: "an element reached through a numeric key is no method of the receiver",
        code: "const handlers = new Map<string, () => void>();\nconst first = 0;\nhandlers[first]();",
      },
      {
        name: "an element reached through a key annotated as a number is no method of the receiver",
        code: "const call = (handlers: Map<string, () => void>, index: number) => handlers[index]();",
      },
      {
        name: "a name this file takes from a package it cannot read is left alone",
        code: "import { Headers } from 'undici';\nconst headers = new Headers();\nheaders.set('a', 'b');",
      },
      {
        name: "a class of one's own whose methods only read is left alone even through a runtime key",
        code: "class Registry {\n  read(name: string) {\n    return name;\n  }\n}\nconst registry = new Registry();\nregistry[picked]();",
      },
      {
        name: "a receiver reached through a property is out of syntactic reach",
        code: "const held = { counts: new Map<string, number>() };\nheld.counts.set('a', 1);",
      },
      {
        name: "a type reached through a namespace is not a type this file can settle",
        code: "const publish = (counts: catalog.Counts) => counts.set('a', 1);",
      },
      {
        name: "a type parameter constrained by one that leads back to it settles nothing",
        code: "const publish = <First extends Second, Second extends First>(counts: First) => counts.set('a', 1);",
      },
      {
        name: "a construction reached through a namespace names no type here",
        code: "const counts = new catalog.Map();\ncounts.set('a', 1);",
      },
      {
        name: "a binding that is not a declarator carries no type to read",
        code: "function counts() {}\ncounts.set('a', 1);",
      },
      {
        name: "a parameter with no annotation carries no type to read",
        code: "const publish = (counts) => counts.set('a', 1);",
      },
      {
        name: "a type this file declares itself is none of the built-in collections",
        code: "interface Counts {\n  set(name: string): void;\n}\nconst publish = (counts: Counts) => counts.set('a');",
      },
      {
        name: "reading through a receiver whose type collapsed is no write",
        code: "const publish = (holder: unknown) => holder.get('a');",
      },
      {
        name: "a member reached through a runtime key outside a call names no method",
        code: "const counts = new Map<string, number>();\nconst held = counts[picked];",
      },
      {
        name: "a runtime key on a receiver whose type collapsed settles nothing to report",
        code: "const publish = (holder: unknown) => holder[picked]();",
      },
      {
        name: "a runtime key on a name taken from a package this repository cannot read",
        code: "import { Headers } from 'undici';\nconst headers = new Headers();\nheaders[picked]();",
      },
      {
        name: "an element reached through a numeric key written out is no method of the receiver",
        code: "const handlers = new Map<string, () => void>();\nhandlers[0]();",
      },
    ],
    invalid: [
      {
        name: "setting an entry writes to the associative collection",
        code: "const counts = new Map<string, number>();\ncounts.set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "an annotation naming the associative collection is read the same way",
        code: "const publish = (counts: Map<string, number>) => counts.delete('a');",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a type parameter constrained by the associative collection is read through its constraint",
        code: "const publish = <Counts extends Map<string, number>>(counts: Counts) => counts.clear();",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "adding a member writes to the set",
        code: "const seen = new Set<string>();\nseen.add('a');",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "the weakly held collections are written to the same way",
        code: "const held = new WeakSet<object>();\nheld.add(key);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a moment made on the spot is still written to by a setter",
        code: "new Date().setHours(0);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "appending to a query string writes to it",
        code: "const query = new URLSearchParams();\nquery.append('page', '1');",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "appending to a form writes to it",
        code: "const form = new FormData();\nform.append('name', 'a');",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "writing through a view over bytes writes to the bytes behind it",
        code: "const view = new DataView(buffer);\nview.setInt8(0, 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a method named through a string index is the method it spells",
        code: "const counts = new Map<string, number>();\ncounts['set']('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a method named through a template without a substitution is the method it spells",
        code: "const counts = new Map<string, number>();\ncounts[`set`]('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "taking the writing method as a value is where the write is decided",
        code: "const counts = new Map<string, number>();\nconst write = counts.set;",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "applying the writing method through call is the same write",
        code: "const counts = new Map<string, number>();\ncounts.set.call(counts, 'a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "an assertion wrapped around the receiver does not settle it as another type",
        code: "const counts = new Map<string, number>();\n(counts as Registry).set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "an assertion is read as the type it names when the expression says nothing",
        code: "(load() as Map<string, number>).set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a receiver reached through an optional chain is the same receiver",
        code: "const counts = new Map<string, number>();\ncounts?.set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "writing into a sink is a write that leaves the program",
        code: "const publish = (writer: WritableStreamDefaultWriter) => writer.write('a');",
        errors: [{ messageId: "sinkReceiverMutation" }],
      },
      {
        name: "handing a chunk to a stream controller is a write that leaves the program",
        code: "const publish = (controller: TransformStreamDefaultController) => controller.enqueue('a');",
        errors: [{ messageId: "sinkReceiverMutation" }],
      },
      {
        name: "a method of one's own class whose body writes to this writes to the instance",
        code: "class Bag {\n  held: string = '';\n  add(entry: string) {\n    this.held = entry;\n  }\n}\nconst bag = new Bag();\nbag.add('a');",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "a write pushed one method deeper is still a write to the instance",
        code: "class Bag {\n  held: string = '';\n  add(entry: string) {\n    this.keep(entry);\n  }\n  keep(entry: string) {\n    this.held = entry;\n  }\n}\nconst bag = new Bag();\nbag.add('a');",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "methods that call each other in a circle settle without looping",
        code: "class Bag {\n  held: number = 0;\n  first() {\n    this.second();\n  }\n  second() {\n    this.first();\n    this.held += 1;\n  }\n}\nconst bag = new Bag();\nbag.first();",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "a method held as a field writes to the instance the same way",
        code: "class Bag {\n  held: string = '';\n  add = (entry: string) => {\n    this.held = entry;\n  };\n}\nconst bag = new Bag();\nbag.add('a');",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "a class written as an expression is read the same way",
        code: "const Bag = class {\n  held?: string;\n  drop() {\n    delete this.held;\n  }\n};\nconst bag = new Bag();\nbag.drop();",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "a receiver whose type collapsed cannot be settled and is reported on the safe side",
        code: "const holder: unknown = load();\nholder.set('a', 1);",
        errors: [{ messageId: "collapsedReceiverMutation" }],
      },
      {
        name: "a parameter whose type collapsed cannot be settled either",
        code: "const publish = (holder: unknown) => holder.append('a');",
        errors: [{ messageId: "collapsedReceiverMutation" }],
      },
      {
        name: "a key known only at runtime hides which method of the collection is called",
        code: "const counts = new Map<string, number>();\ncounts[picked]('a', 1);",
        errors: [{ messageId: "runtimeKeyReceiverMutation" }],
      },
      {
        name: "a template carrying a substitution hides the method name the same way",
        code: "const counts = new Map<string, number>();\ncounts[`set${suffix}`]('a', 1);",
        errors: [{ messageId: "runtimeKeyReceiverMutation" }],
      },
      {
        name: "a type that is the associative collection among other things is that collection",
        code: "const publish = (counts: Map<string, number> | undefined) => counts.set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a static method whose body writes to this writes to the class that holds it",
        code: "class Registry {\n  static held = '';\n  static add(name: string) {\n    this.held = name;\n  }\n}\nRegistry.add('a');",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "a class this file sends away is read the same way",
        code: "export class Bag {\n  held = '';\n  add(entry: string) {\n    this.held = entry;\n  }\n}\nconst bag = new Bag();\nbag.add('a');",
        errors: [{ messageId: "declaredClassMutation" }],
      },
      {
        name: "a class this file sends away without a name binds no name to read",
        code: "export default class {}\nconst counts = new Map<string, number>();\ncounts.set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a name taken as the whole of another module leaves the collection settled",
        code: "import catalog from './catalog.ts';\nimport * as held from './held.ts';\nimport { 'Bag' as Holder } from './bag.ts';\nconst counts = new Map<string, number>();\ncounts.delete('a');",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "a key that is a literal but no number still hides the method name",
        code: "const counts = new Map<string, number>();\ncounts[true]('a');",
        errors: [{ messageId: "runtimeKeyReceiverMutation" }],
      },
      {
        name: "a key put together while the program runs hides the method name as well",
        code: "const counts = new Map<string, number>();\ncounts[picked + suffix]('a');",
        errors: [{ messageId: "runtimeKeyReceiverMutation" }],
      },
      {
        name: "a key whose type is nowhere to read is not settled as a number",
        code: "const call = (handlers: Map<string, () => void>, picked) => handlers[picked]();",
        errors: [{ messageId: "runtimeKeyReceiverMutation" }],
      },
      {
        name: "a name this file only sends onward declares nothing to read here",
        code: "export { load };\nconst counts = new Map<string, number>();\ncounts.set('a', 1);",
        errors: [{ messageId: "builtinReceiverMutation" }],
      },
      {
        name: "each written method in one expression is its own report",
        code: "const query = new URLSearchParams();\nquery.append('a', '1');\nquery.sort();",
        errors: [
          { messageId: "builtinReceiverMutation" },
          { messageId: "builtinReceiverMutation" },
        ],
      },
    ],
  });
});
