import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { aliasedPathsFor } from "./tsconfig-path-aliases.ts";

const it = test
  .extend("workspaceRoot", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "tsconfig-path-aliases-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  })
  .extend("pathsOfASpecifierStandingForAPath", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierShorterThanTheDeclaration", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({ specifier: "@data", fromFile: join(directory, "reader.ts") });
  })
  .extend("pathsOfASpecifierOpeningDifferently", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@other/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfTheSpecifierAnExactDeclarationSpells", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "exact");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@data/table": ["./values/table.assets.ts"] } } }\n',
    );
    return aliasedPathsFor({ specifier: "@data/table", fromFile: join(directory, "reader.ts") });
  })
  .extend("pathsOfASpecifierAnExactDeclarationDoesNotSpell", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "exact");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@data/table": ["./values/table.assets.ts"] } } }\n',
    );
    return aliasedPathsFor({ specifier: "@data/other", fromFile: join(directory, "reader.ts") });
  })
  .extend("pathsOfASpecifierUnderTheLongestOpening", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "layered");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@data/*": ["./shallow/*"], "@data/deep/*": ["./deep/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/deep/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierUnderTheLongestOpeningWrittenFirst", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "reversed");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@data/deep/*": ["./deep/*"], "@data/*": ["./shallow/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/deep/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierMeetingTwoWildcards", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wild");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/left/right",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierMeetingASinglePathTarget", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wild");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "paths": { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } } }\n',
    );
    return aliasedPathsFor({ specifier: "@data/held", fromFile: join(directory, "reader.ts") });
  })
  .extend("pathsOfASpecifierReadFromTheDeclaredBaseDirectory", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "based");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierDeclaredByAnInheritedConfiguration", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "inherited");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "extends": ["./tsconfig.base.json"] }\n');
    writeFileSync(
      join(directory, "tsconfig.base.json"),
      '{ "compilerOptions": { "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierUnderAConfigurationInheritedFromAPackage", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "packaged");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "extends": "@fixture/preset/tsconfig.json" }\n',
    );
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierUnderConfigurationsExtendingInACircle", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "circular");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./tsconfig.other.json" }\n');
    writeFileSync(join(directory, "tsconfig.other.json"), '{ "extends": "./tsconfig.json" }\n');
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierUnderAConfigurationThatIsNotAnObject", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "listed");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), "[]");
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierUnderAProjectDeclaringNoPaths", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "plain");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "tsconfig.json"), '{ "compilerOptions": { "strict": true } }\n');
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierUnderADirectoryHoldingNoConfiguration", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "bare");
    mkdirSync(directory, { recursive: true });
    return aliasedPathsFor({
      specifier: "@data/order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierNamingThisDirectory", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "./order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierNamingTheDirectoryAbove", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: "../order.assets.ts",
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASpecifierNamingAnAbsolutePlace", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({
      specifier: join(directory, "order.assets.ts"),
      fromFile: join(directory, "reader.ts"),
    });
  })
  .extend("pathsOfASubpathSpecifier", ({ workspaceRoot }) => {
    const directory = join(workspaceRoot, "wildcard");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "tsconfig.json"),
      '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
    );
    return aliasedPathsFor({ specifier: "#data", fromFile: join(directory, "reader.ts") });
  });

describe("tsconfig-path-aliases", () => {
  it("a specifier standing for a path is read as the path the project declares for it", ({
    pathsOfASpecifierStandingForAPath,
    workspaceRoot,
  }) => {
    expect(pathsOfASpecifierStandingForAPath).toStrictEqual([
      join(workspaceRoot, "wildcard", "values", "order.assets.ts"),
    ]);
  });

  it("a specifier shorter than the declaration stands for nothing", ({
    pathsOfASpecifierShorterThanTheDeclaration,
  }) => {
    expect(pathsOfASpecifierShorterThanTheDeclaration).toStrictEqual([]);
  });

  it("a specifier opening differently from the declaration stands for nothing", ({
    pathsOfASpecifierOpeningDifferently,
  }) => {
    expect(pathsOfASpecifierOpeningDifferently).toStrictEqual([]);
  });

  it("a declaration carrying no wildcard stands for exactly the specifier it spells", ({
    pathsOfTheSpecifierAnExactDeclarationSpells,
    workspaceRoot,
  }) => {
    expect(pathsOfTheSpecifierAnExactDeclarationSpells).toStrictEqual([
      join(workspaceRoot, "exact", "values", "table.assets.ts"),
    ]);
  });

  it("a declaration carrying no wildcard stands for no other specifier", ({
    pathsOfASpecifierAnExactDeclarationDoesNotSpell,
  }) => {
    expect(pathsOfASpecifierAnExactDeclarationDoesNotSpell).toStrictEqual([]);
  });

  it("the declaration spelling the longest opening is the one that stands for the specifier", ({
    pathsOfASpecifierUnderTheLongestOpening,
    workspaceRoot,
  }) => {
    expect(pathsOfASpecifierUnderTheLongestOpening).toStrictEqual([
      join(workspaceRoot, "layered", "deep", "order.assets.ts"),
    ]);
  });

  it("the order the declarations are written in does not decide which one stands", ({
    pathsOfASpecifierUnderTheLongestOpeningWrittenFirst,
    workspaceRoot,
  }) => {
    expect(pathsOfASpecifierUnderTheLongestOpeningWrittenFirst).toStrictEqual([
      join(workspaceRoot, "reversed", "deep", "order.assets.ts"),
    ]);
  });

  it("a declaration spelling two wildcards stands for nothing", ({
    pathsOfASpecifierMeetingTwoWildcards,
  }) => {
    expect(pathsOfASpecifierMeetingTwoWildcards).toStrictEqual([]);
  });

  it("a declaration holding a single path instead of a list stands for nothing", ({
    pathsOfASpecifierMeetingASinglePathTarget,
  }) => {
    expect(pathsOfASpecifierMeetingASinglePathTarget).toStrictEqual([]);
  });

  it("the paths a project declares are read from the base directory it names", ({
    pathsOfASpecifierReadFromTheDeclaredBaseDirectory,
    workspaceRoot,
  }) => {
    expect(pathsOfASpecifierReadFromTheDeclaredBaseDirectory).toStrictEqual([
      join(workspaceRoot, "based", "src", "values", "order.assets.ts"),
    ]);
  });

  it("a project that inherits its paths reads them from the configuration it extends", ({
    pathsOfASpecifierDeclaredByAnInheritedConfiguration,
    workspaceRoot,
  }) => {
    expect(pathsOfASpecifierDeclaredByAnInheritedConfiguration).toStrictEqual([
      join(workspaceRoot, "inherited", "values", "order.assets.ts"),
    ]);
  });

  it("a configuration inherited from an installed package carries no paths of its own", ({
    pathsOfASpecifierUnderAConfigurationInheritedFromAPackage,
  }) => {
    expect(pathsOfASpecifierUnderAConfigurationInheritedFromAPackage).toStrictEqual([]);
  });

  it("configurations that extend each other in a circle come to an end", ({
    pathsOfASpecifierUnderConfigurationsExtendingInACircle,
  }) => {
    expect(pathsOfASpecifierUnderConfigurationsExtendingInACircle).toStrictEqual([]);
  });

  it("a configuration that is not an object of settings declares no paths", ({
    pathsOfASpecifierUnderAConfigurationThatIsNotAnObject,
  }) => {
    expect(pathsOfASpecifierUnderAConfigurationThatIsNotAnObject).toStrictEqual([]);
  });

  it("a project that declares no paths at all stands for nothing", ({
    pathsOfASpecifierUnderAProjectDeclaringNoPaths,
  }) => {
    expect(pathsOfASpecifierUnderAProjectDeclaringNoPaths).toStrictEqual([]);
  });

  it("a directory holding no configuration at all stands for nothing", ({
    pathsOfASpecifierUnderADirectoryHoldingNoConfiguration,
  }) => {
    expect(pathsOfASpecifierUnderADirectoryHoldingNoConfiguration).toStrictEqual([]);
  });

  it("a specifier naming this directory is never read as a path alias", ({
    pathsOfASpecifierNamingThisDirectory,
  }) => {
    expect(pathsOfASpecifierNamingThisDirectory).toStrictEqual([]);
  });

  it("a specifier naming the directory above is never read as a path alias", ({
    pathsOfASpecifierNamingTheDirectoryAbove,
  }) => {
    expect(pathsOfASpecifierNamingTheDirectoryAbove).toStrictEqual([]);
  });

  it("a specifier naming an absolute place is never read as a path alias", ({
    pathsOfASpecifierNamingAnAbsolutePlace,
  }) => {
    expect(pathsOfASpecifierNamingAnAbsolutePlace).toStrictEqual([]);
  });

  it("a subpath specifier is never read as a path alias", ({ pathsOfASubpathSpecifier }) => {
    expect(pathsOfASubpathSpecifier).toStrictEqual([]);
  });
});
