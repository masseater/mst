---
description: "Disallow a binding named by one of the ambiguous-name patterns, so the name says what the binding holds instead of sending a reader upstream to the assignment"
---

# no-ambiguous-variable-name--rename-to-concrete-noun

<!-- BEGIN GENERATED rule-header -->

Disallow a binding named by one of the ambiguous-name patterns, so the name says what the binding holds instead of sending a reader upstream to the assignment

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-ambiguous-variable-name--rename-to-concrete-noun.ts`](../../src/lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts)

<!-- END GENERATED rule-header -->

## Violation

A binding whose name the writer chose, where that name matches one of the forbidden patterns. Five positions are read:

- A variable declarator whose binding is a plain identifier, whatever the declaration keyword (`const`, `let`, `var`) and whether or not there is an initialiser. The binding of `for (const value of lines)` is included
- A name newly given by a renaming object destructure (the `entry` of `const { parsed: entry } = payload;`)
- A binding of an array destructure (`const [value] = lines;`). What is taken out is settled by position, so the name is the writer's
- Parameters of functions, methods and arrow functions, including bindings with defaults and rest bindings
- Class fields

Four positions are out of reach because the name is not the writer's:

- A destructure without renaming (`const { data } = payload;`). What is taken out follows the shape of the object it came from
- Property names in object literals. The position where the shape of an external API is written as it is
- Computed class field keys
- A class field carrying `override`. The name was settled by the base
- A catch binding

Before matching, meaningless decoration is stripped from the name: leading and trailing underscores and dollar signs, trailing digits, and leading qualifiers that name no subject of their own (`the`, `a`, `my`, `some`, `new`, `old`, `raw`, `real`, `just`, `only`, `simple`, `plain`, `generic`, `other`, `this`, `that`, `current`, `prev`, `next` and the like). What remains after stripping is what gets matched. Where stripping would leave nothing, the last word is kept, so a name built entirely out of qualifiers, such as `current`, does not escape the judgment.

Matching ignores case. The report points at the identifier rather than at the whole declaration statement.

The default vocabulary is always in force. Configuration only adds to it — it can neither remove entries nor empty it — so a state where this rule checks nothing cannot be created.

### The invariant

A generic name points at a container something came out of rather than at its subject. All a binding named `data` says is that it is data of some sort, and whether it is a parsed configuration or a fetched record is not there. Abbreviations (`res`, `ret`, `val`, `ctx`) throw the subject away entirely. `actual` states a role in the etiquette of verification and hides which subject is bound.

The reader ends up learning the subject by tracing the assignment upstream rather than reading the name. The distance from declaration to use site becomes the cost of reading.

The bar for the vocabulary is "a word from which the concrete subject being bound does not settle". How something matches is part of the vocabulary.

Two entries match as suffixes, so a compound ending in them falls too:

| Pattern    | What falls                |
| ---------- | ------------------------- |
| `outcome$` | `outcome`, `queryOutcome` |
| `result$`  | `result`, `parseResult`   |

Those two mean "an assortment of the results of something". Whatever prefix is added still conveys only "the results of something", so the compound falls with them.

Everything else matches exactly, falling only when the whole normalised name is that word. The words fall into eight families:

| Family | Examples |
| --- | --- |
| Words naming the value itself, and abbreviations | `val`, `value`, `res`, `ret`, `data`, `datum` |
| Names of containers | `obj`, `arr`, `str`, `item`, `entry`, `record`, `row`, `list`, `map`, `set`, `group`, `buf`, `chunk`, `content`, `body`, `payload` |
| Placeholder names and names of somewhere to put things | `temp`, `tmp`, `dummy`, `sample`, `foo`, `bar`, `baz`, `qux` |
| Words naming only a role in a exchange | `req`, `request`, `response`, `reply`, `answer` |
| Names of machinery | `ctx`, `context`, `opts`, `options`, `params`, `args`, `flag`, `state`, `status`, `fn`, `cb`, `callback`, `handler`, `helper`, `util`, `wrapper`, `instance` |
| Roles in the etiquette of verification | `actual`, `expected` |
| Words naming only a kind of attribute | `id`, `key`, `name`, `type`, `kind`, `mode`, `label`, `text`, `message`, `count`, `total`, `size`, `length` |
| Words naming only a unit of measurement | `date`, `time`, `timestamp`, `now` |
| Results of an operation carrying no subject | `parsed`, `formatted`, `normalized`, `converted`, `mapped`, `filtered`, `sorted`, `merged` |

Singular and plural are treated as one word.

The match is exact so that legitimate names merely containing one of the words are not dragged in. `interval` carries `val` inside it, `defaultValue` ends in `value`, and `metadata` ends in `data`; matching those as suffixes would drop names that do state their subject. For the same reason `output` and `info` sit among the exact matches, and `gitOutput` and `userInfo` pass as names that state a subject.

Parameters are targets because, even where the signature being implemented gives the same position a name, a JavaScript parameter name is invisible to the caller and can be renamed by the implementation at any time. The positions where the contract tempts you to write `context` or `options` are exactly the ones where that name says nothing about what is bound.

### Configuration

One list of name patterns is taken and added to the default vocabulary.

```ts
[{ pattern: "^bucket$" }, { pattern: "envelope$" }];
```

Each entry is an object carrying exactly one `pattern`, whose value is a regular expression source string, with no delimiters, matched against the normalised identifier. Whether it is anchored settles how it matches. Any key other than `pattern` is refused by the schema.

The default vocabulary checks even with no configuration handed over. It lives in `FORBIDDEN_AMBIGUOUS_NAMES` in `src/lint/oxlint/lib/forbidden-ambiguous-names.ts`, and `no-expect-forbidden-subject-name--rename-to-concrete-subject`, which checks the names of assertion subjects, reads the same list as its default. Adding a word touches that one place. Split across two, the same name would pass in a declaration and fail in an assertion, or the reverse.

## Fix

Rename the binding to a noun naming what it holds: the parsed schema value, the rendered fragment, the fetched record, the caught error.

Where one block produces several candidate concrete names and none can be settled on, that block is doing several jobs. Split the block rather than compromising on the name.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a compound name ending in a bag word is reported on the name itself
const parseResult = parse(source);
```

```ts
// a decoration in front of a forbidden word does not rescue the name
const theData = load();
```

Code this rule accepts.

```ts
// an object pattern takes its names from the shape it destructures
const { data } = payload;
```

```ts
// a name that merely contains a forbidden word still names its subject
const interval = 30;
const defaultValue = 0;
const metadata = read();
const resultCount = 3;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding a meaningless prefix or suffix to escape the exact match (`theData`, `res2`, `_data`). The decoration is stripped before matching, so the report stands
- Receiving it under a concrete name and moving it into an alias that is a forbidden word. One declaration was added and the name the use sites read is still vague
- Pushing the forbidden binding out into a parameter, a class field or an array destructure. All are target positions, so the report stands
- Removing a word from the vocabulary to clear one violation. The vocabulary is configuration and can be added to; there is no means of removing a default

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `ambiguousVariableName` | The name \`{{name}}\` must not be used as a binding name. Rename it to a noun that names the value itself: the parsed config, the rendered fragment, the fetched record, the caught error. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
