import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attemptAsync } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import {
  directoryNamesIn,
  nonEmptyStringOrNull,
  readJsonObjectOrNull,
  readTextOrNull,
  statOrNull,
} from "./read-file.ts";

const UNREADABLE_PATH = "\0";

const it = test
  .extend("fileVerdictOnAPathThatIsThere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const documentPath = join(root, "AGENTS.md");
    writeFileSync(documentPath, "# root\n", "utf8");
    const described = await statOrNull(documentPath);
    return described?.isFile();
  })
  .extend("descriptionOfAPathThatIsNotThere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return statOrNull(join(root, "missing.md"));
  })
  .extend("descriptionOfAPathRoutedThroughAFile", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const documentPath = join(root, "AGENTS.md");
    writeFileSync(documentPath, "# root\n", "utf8");
    return statOrNull(join(documentPath, "below.md"));
  })
  .extend("failureFromDescribingARefusedPath", async () => {
    const [failure] = await attemptAsync<unknown, Error>(() => statOrNull(UNREADABLE_PATH));
    return failure === null ? null : failure.message;
  })
  .extend("textOfAFileThatIsThere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const documentPath = join(root, "AGENTS.md");
    writeFileSync(documentPath, "# root\n", "utf8");
    return readTextOrNull(documentPath);
  })
  .extend("textOfAFileThatIsNotThere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return readTextOrNull(join(root, "missing.md"));
  })
  .extend("failureFromReadingADirectory", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const [failure] = await attemptAsync<unknown, Error>(() => readTextOrNull(root));
    return failure === null ? null : failure.message;
  })
  .extend("directoryNamesOfADirectoryHoldingBoth", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "packages"));
    writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
    return directoryNamesIn(root);
  })
  .extend("directoryNamesOfADirectoryThatIsNotThere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return directoryNamesIn(join(root, "missing"));
  })
  .extend("failureFromListingARefusedPath", async () => {
    const [failure] = await attemptAsync<unknown, Error>(() => directoryNamesIn(UNREADABLE_PATH));
    return failure === null ? null : failure.message;
  })
  .extend("manifestThatParsesIntoAnObject", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const manifestPath = join(root, "package.json");
    writeFileSync(manifestPath, '{"name":"user"}', "utf8");
    return readJsonObjectOrNull(manifestPath);
  })
  .extend("manifestThatIsNotThere", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return readJsonObjectOrNull(join(root, "package.json"));
  })
  .extend("manifestThatParsesIntoAList", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const manifestPath = join(root, "list.json");
    writeFileSync(manifestPath, "[1]", "utf8");
    return readJsonObjectOrNull(manifestPath);
  })
  .extend("manifestThatParsesIntoNothing", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const manifestPath = join(root, "null.json");
    writeFileSync(manifestPath, "null", "utf8");
    return readJsonObjectOrNull(manifestPath);
  })
  .extend("manifestThatParsesIntoAWord", async ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const manifestPath = join(root, "name.json");
    writeFileSync(manifestPath, '"user"', "utf8");
    return readJsonObjectOrNull(manifestPath);
  })
  .extend("wordReadFromSpacesAroundAWord", () => nonEmptyStringOrNull("  user  "))
  .extend("wordReadFromANumber", () => nonEmptyStringOrNull(1))
  .extend("wordReadFromSpacesAlone", () => nonEmptyStringOrNull("   "));

describe("read-file", () => {
  it("a path that is there is described", ({ fileVerdictOnAPathThatIsThere }) => {
    expect(fileVerdictOnAPathThatIsThere).toBe(true);
  });

  it("a path that is not there is an absence", ({ descriptionOfAPathThatIsNotThere }) => {
    expect(descriptionOfAPathThatIsNotThere).toBe(null);
  });

  it("a path routed through a file instead of a directory is an absence as well", ({
    descriptionOfAPathRoutedThroughAFile,
  }) => {
    expect(descriptionOfAPathRoutedThroughAFile).toBe(null);
  });

  it("a path the runtime refuses outright is raised", ({ failureFromDescribingARefusedPath }) => {
    expect(failureFromDescribingARefusedPath).toBe(
      "The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received '\\x00'",
    );
  });

  it("a file that is there is read", ({ textOfAFileThatIsThere }) => {
    expect(textOfAFileThatIsThere).toBe("# root\n");
  });

  it("a file that is not there reads as an absence", ({ textOfAFileThatIsNotThere }) => {
    expect(textOfAFileThatIsNotThere).toBe(null);
  });

  it("a read the runtime refuses outright is raised", ({ failureFromReadingADirectory }) => {
    expect(failureFromReadingADirectory).toBe("EISDIR: illegal operation on a directory, read");
  });

  it("the directories of a directory are named", ({ directoryNamesOfADirectoryHoldingBoth }) => {
    expect(directoryNamesOfADirectoryHoldingBoth).toStrictEqual(["packages"]);
  });

  it("a directory that is not there names nothing", ({
    directoryNamesOfADirectoryThatIsNotThere,
  }) => {
    expect(directoryNamesOfADirectoryThatIsNotThere).toStrictEqual([]);
  });

  it("a listing the runtime refuses outright is raised", ({ failureFromListingARefusedPath }) => {
    expect(failureFromListingARefusedPath).toBe(
      "The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received '\\x00'",
    );
  });

  it("a manifest that parses into an object is read as that object", ({
    manifestThatParsesIntoAnObject,
  }) => {
    expect(manifestThatParsesIntoAnObject).toStrictEqual({ name: "user" });
  });

  it("a manifest that is not there is an absence", ({ manifestThatIsNotThere }) => {
    expect(manifestThatIsNotThere).toBe(null);
  });

  it("a manifest that parses into a list is an absence", ({ manifestThatParsesIntoAList }) => {
    expect(manifestThatParsesIntoAList).toBe(null);
  });

  it("a manifest that parses into nothing at all is an absence", ({
    manifestThatParsesIntoNothing,
  }) => {
    expect(manifestThatParsesIntoNothing).toBe(null);
  });

  it("a manifest that parses into a word is an absence", ({ manifestThatParsesIntoAWord }) => {
    expect(manifestThatParsesIntoAWord).toBe(null);
  });

  it("a value that is a word is handed back trimmed", ({ wordReadFromSpacesAroundAWord }) => {
    expect(wordReadFromSpacesAroundAWord).toBe("user");
  });

  it("a value that is not a word is an absence", ({ wordReadFromANumber }) => {
    expect(wordReadFromANumber).toBe(null);
  });

  it("a value that is only spaces is an absence", ({ wordReadFromSpacesAlone }) => {
    expect(wordReadFromSpacesAlone).toBe(null);
  });
});
