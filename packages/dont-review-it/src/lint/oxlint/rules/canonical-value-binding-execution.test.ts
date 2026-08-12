import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: execution index", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a write and call after return are unreachable",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction localize() { values = ["draft", "published"] as const; }\nfunction mutate() { return; values = ["draft", "published"] as const; localize(); }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "a write and call after throw are unreachable",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction localize() { values = ["draft", "published"] as const; }\nfunction mutate() { throw new Error(); values = ["draft", "published"] as const; localize(); }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "a write and call after break are unreachable",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction localize() { values = ["draft", "published"] as const; }\nfunction mutate() { while (true) { break; values = ["draft", "published"] as const; localize(); } }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "a write and call after continue are unreachable",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction localize() { values = ["draft", "published"] as const; }\nfunction mutate() { for (let index = 0; index < 1; index++) { continue; values = ["draft", "published"] as const; localize(); } }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "a write after a returning try and empty finally is unreachable",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction mutate() { try { return; } finally {} values = ["draft", "published"] as const; }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "a false static binary guard is skipped",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nif (1 === 2) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "a false for test skips its update expression",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfor (; false; values = ["draft", "published"] as const) {}\nexport const schema = z.enum(values);',
      },
      {
        name: "a null optional member skips its computed key",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nnull?.[(values = ["draft", "published"] as const)];\nexport const schema = z.enum(values);',
      },
      {
        name: "a default after a matching broken switch case is skipped",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nswitch ("draft") { case "draft": break; default: values = ["draft", "published"] as const; }\nexport const schema = z.enum(values);',
      },
      {
        name: "a catch after a statically nonthrowing try body is skipped",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\ntry { const value = 0; void value; } catch { values = ["draft", "published"] as const; }\nexport const schema = z.enum(values);',
      },
      {
        name: "a caller write after the only call does not enter the callee",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nschema();\nvalues = ["draft", "published"] as const;\nfunction schema() { return z.enum(values); }',
      },
      {
        name: "a direct empty array loop executes zero times",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfor (const value of []) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "an aliased empty array loop executes zero times",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nconst empty = [];\nfor (const value of empty) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "a direct empty object for in loop executes zero times",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfor (const key in {}) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "an aliased empty object for in loop executes zero times",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nconst empty = {};\nfor (const key in empty) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "a direct empty string loop executes zero times",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfor (const value of "") values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "an aliased empty string loop executes zero times",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nconst empty = "";\nfor (const value of empty) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
      },
      {
        name: "calling a generator does not execute its body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction* mutate() { values = ["draft", "published"] as const; yield 0; }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "calling an async generator does not execute its body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nasync function* mutate() { values = ["draft", "published"] as const; yield 0; }\nmutate();\nexport const schema = z.enum(values);',
      },
      {
        name: "calling a generator does not execute a schema sink in its body",
        code: 'function* schema() { z.enum(["draft", "published"] as const); yield 0; }\nschema();',
      },
      {
        name: "an unconstructed instance field initializer does not execute",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nclass Helper { field = (values = ["draft", "published"] as const); }\nexport const schema = z.enum(values);',
      },
      {
        name: "an unconstructed instance field schema sink does not execute",
        code: 'class Helper { field = z.enum(["draft", "published"] as const); }',
      },
      {
        name: "an unread getter schema sink does not execute",
        code: 'const helper = { get schema() { return z.enum(["draft", "published"] as const); } };\nconsume(helper);',
      },
      {
        name: "an uncalled ordinary function schema sink does not execute",
        code: 'function schema() { z.enum(["draft", "published"] as const); }\nconsume(schema);',
      },
      {
        name: "passing a callback without invoking it does not execute its schema sink",
        code: 'function ignore(_callback: () => void) {}\nignore(() => { z.enum(["draft", "published"] as const); });',
      },
      {
        name: "an empty array forEach executes its callback zero times",
        code: '([] as number[]).forEach(() => { z.enum(["draft", "published"] as const); });',
      },
      {
        name: "an empty array map executes its callback zero times",
        code: '([] as number[]).map(() => z.enum(["draft", "published"] as const));',
      },
      {
        name: "a decorator on a class in an uncalled function does not execute",
        code: 'function register() { z.enum(["draft", "published"] as const); }\nfunction define() { @register class Example {} return Example; }\nconsume(define);',
      },
    ],
    invalid: [
      {
        name: "caller writes are projected separately at multiple call sites",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nschema();\nvalues = ["draft", "published"] as const;\nschema();\nfunction schema() { return z.enum(values); }',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a statically unique object method call executes its helper",
        code: 'const helper = { schema(values) { return z.enum(values); } };\nhelper.schema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nonempty array forEach executes its callback",
        code: '[0].forEach(() => { z.enum(["draft", "published"] as const); });',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nonempty array map executes its callback",
        code: '[0].map(() => z.enum(["draft", "published"] as const));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a user helper executes a callback parameter it calls",
        code: 'function invoke(callback: () => void) { callback(); }\ninvoke(() => { z.enum(["draft", "published"] as const); });',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a statically unique static class method call executes its helper",
        code: 'class Helper { static schema(values) { return z.enum(values); } }\nHelper.schema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a statically unique instance class method call executes its helper",
        code: 'class Helper { schema(values) { return z.enum(values); } }\nconst helper = new Helper();\nhelper.schema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a new expression executes its constructor parameters",
        code: 'class Helper { constructor(values) { z.enum(values); } }\nnew Helper(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Function call normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nschema.call(null, ["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Function apply normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nschema.apply(null, [["draft", "published"] as const]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Reflect apply normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nReflect.apply(schema, null, [["draft", "published"] as const]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Function call through call normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nFunction.prototype.call.call(schema, null, ["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Function apply through call normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nFunction.prototype.apply.call(schema, null, [["draft", "published"] as const]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Reflect apply through Reflect apply normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nReflect.apply(Reflect.apply, null, [schema, null, [["draft", "published"] as const]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Reflect apply through call normalizes a helper execution",
        code: 'function schema(values) { return z.enum(values); }\nReflect.apply.call(null, schema, null, [["draft", "published"] as const]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Function call bound to a helper normalizes its execution",
        code: 'function schema(values) { return z.enum(values); }\nconst invoke = Function.prototype.call.bind(schema, null);\ninvoke(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Function apply bound to a helper normalizes its execution",
        code: 'function schema(values) { return z.enum(values); }\nconst invoke = Function.prototype.apply.bind(schema, null);\ninvoke([["draft", "published"] as const]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound helper is executed through its bound arguments",
        code: 'function schema(values) { return z.enum(values); }\nconst bound = schema.bind(null, ["draft", "published"] as const);\nbound();',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a mixed empty and nonempty loop candidate remains possible",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nconst iterable = enabled ? [] : [0];\nfor (const value of iterable) values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "generator next advances and executes its body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction* mutate() { values = ["draft", "published"] as const; yield 0; }\nconst iterator = mutate();\niterator.next();\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "generator next executes a schema sink in its body",
        code: 'function* schema() { z.enum(["draft", "published"] as const); yield 0; }\nconst iterator = schema();\niterator.next();',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "for of advances and executes a generator body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction* mutate() { values = ["draft", "published"] as const; yield 0; }\nfor (const value of mutate()) consume(value);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "spread advances and executes a generator body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction* mutate() { values = ["draft", "published"] as const; yield 0; }\n[...mutate()];\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "async generator next advances and executes its body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nasync function* mutate() { values = ["draft", "published"] as const; yield 0; }\nconst iterator = mutate();\niterator.next();\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "new executes a nonstatic instance field initializer",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nclass Helper { field = (values = ["draft", "published"] as const); }\nnew Helper();\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "new executes a nonstatic instance field schema sink",
        code: 'class Helper { field = z.enum(["draft", "published"] as const); }\nnew Helper();',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "derived super executes a derived instance field initializer",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nclass Base {}\nclass Helper extends Base { field = (values = ["draft", "published"] as const); constructor() { super(); } }\nnew Helper();\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation executes a static field initializer",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nclass Helper { static field = (values = ["draft", "published"] as const); }\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation executes a static block",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nclass Helper { static { values = ["draft", "published"] as const; } }\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation executes a computed instance field key",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nclass Helper { [(values = ["draft", "published"] as const, "field")] = 0; }\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a tagged helper projects substitutions into a rest parameter",
        code: 'const schema = (_parts, ...values) => z.enum(values);\nschema`${"draft"}${"published"}`;',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static getter return supplies a local array to a member read",
        code: 'const helper = { get values() { return ["draft", "published"] as const; } };\nexport const schema = z.enum(helper.values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static getter read executes its body",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nconst helper = { get values() { values = ["draft", "published"] as const; return values; } };\nhelper.values;\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a getter read executes a schema sink in its body",
        code: 'const helper = { get schema() { return z.enum(["draft", "published"] as const); } };\nhelper.schema;',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static setter write executes its body with the assigned parameter",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nconst helper = { set values(next) { values = next; } };\nhelper.values = ["draft", "published"] as const;\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "binary string concatenation contributes static schema values",
        code: 'export const schema = z.enum(["dra" + "ft", "pub" + "lished"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "static string calls contribute schema values",
        code: 'export const schema = z.enum(["dra".concat("ft"), ["pub", "lished"].join("")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "static String constructors contribute schema values",
        code: "export const schema = z.enum([String.fromCharCode(100, 114, 97, 102, 116), String.fromCodePoint(112, 117, 98, 108, 105, 115, 104, 101, 100)]);",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a finally write remains executable before an abrupt completion",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\nfunction mutate() { try { return; } finally { values = ["draft", "published"] as const; } }\nmutate();\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an explicitly throwing try body executes its catch",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet values = ORDER_STATUSES;\ntry { throw new Error(); } catch { values = ["draft", "published"] as const; }\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation invokes its class decorator",
        code: 'function register() { z.enum(["draft", "published"] as const); }\n@register class Example {}',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation invokes a method decorator",
        code: 'function register() { z.enum(["draft", "published"] as const); }\nclass Example { @register method() {} }',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation invokes a field decorator",
        code: 'function register() { z.enum(["draft", "published"] as const); }\nclass Example { @register field = 0; }',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "class evaluation invokes a decorator returned by a factory",
        code: 'function factory() { return () => { z.enum(["draft", "published"] as const); }; }\n@factory() class Example {}',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "using invokes a static Symbol dispose method",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\n{ using resource = { [Symbol.dispose]() { values.pop(); } }; }\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "for of invokes a static custom iterator",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst iterable = { [Symbol.iterator]() { values.pop(); return [0][Symbol.iterator](); } };\nfor (const value of iterable) consume(value);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array destructuring invokes a static custom iterator",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst iterable = { [Symbol.iterator]() { values.pop(); return [0][Symbol.iterator](); } };\nconst [value] = iterable;\nconsume(value);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array spread invokes a static custom iterator",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst iterable = { [Symbol.iterator]() { values.pop(); return [0][Symbol.iterator](); } };\nconsume([...iterable]);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a getter invocation contributes its collection mutation",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst source = { get selected() { values.pop(); return 0; } };\nconsume(source.selected);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a setter invocation contributes its collection mutation",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst target = { set selected(value) { values.pop(); } };\ntarget.selected = 0;\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "template coercion invokes a static Symbol toPrimitive method",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst source = { [Symbol.toPrimitive]() { values.pop(); return ""; } };\nconsume(`${source}`);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "instanceof invokes a static Symbol hasInstance method",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst values = [...ORDER_STATUSES];\nconst type = { [Symbol.hasInstance]() { values.pop(); return false; } };\nconsume({} instanceof type);\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
