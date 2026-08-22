import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { unpinnedActionRefs } from "./pinned-action-ref.ts";

const PINNED_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

const VERSION_ANNOTATION_MESSAGE =
  "A pinned action reference must not stand without the version it pins, because a bare commit SHA leaves nothing to read: neither what this step runs today, nor what an update to it changed. Write the released version beside the SHA as a trailing comment, in the form `owner/repo@<sha> # v1.2.3`.";

describe("unpinnedActionRefs", () => {
  describe("a step whose reference ends in a tag", () => {
    const it = test.extend("taggedStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: actions/checkout@v5\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports it as a reference that moves", ({ taggedStepProblems }) => {
      expect(taggedStepProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 4,
          message:
            "An action reference must not end in a tag or a branch, because both move: `actions/checkout@v5` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after `@` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.",
        },
      ]);
    });
  });

  describe("a step whose reference ends in a branch", () => {
    const it = test.extend("branchStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: actions/checkout@main\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports it as a reference that moves", ({ branchStepProblems }) => {
      expect(branchStepProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 4,
          message:
            "An action reference must not end in a tag or a branch, because both move: `actions/checkout@main` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after `@` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.",
        },
      ]);
    });
  });

  describe("a step whose reference names no ref at all", () => {
    const it = test.extend("reflessStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports it rather than reading the missing ref as pinned", ({ reflessStepProblems }) => {
      expect(reflessStepProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 4,
          message:
            "An action reference must not end in a tag or a branch, because both move: `actions/checkout` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after `@` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.",
        },
      ]);
    });
  });

  describe("a step whose reference ends in a shortened commit SHA", () => {
    const it = test.extend("shortenedShaStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${PINNED_SHA.slice(0, 7)}\n`,
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports it rather than accepting a prefix of a SHA", ({ shortenedShaStepProblems }) => {
      expect(shortenedShaStepProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 4,
          message:
            "An action reference must not end in a tag or a branch, because both move: `actions/checkout@3d3c42e` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after `@` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.",
        },
      ]);
    });
  });

  describe("a step whose reference names an action other than the one every example uses", () => {
    const it = test.extend("setupNodeStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v4\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("writes that reference into the message it hands back", ({ setupNodeStepProblems }) => {
      expect(setupNodeStepProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 4,
          message:
            "An action reference must not end in a tag or a branch, because both move: `actions/setup-node@v4` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after `@` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.",
        },
      ]);
    });
  });

  describe("a step pinned to a full commit SHA that says nothing about the version it pins", () => {
    const it = test.extend("bareShaStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${PINNED_SHA}\n`,
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("asks for the released version beside the SHA", ({ bareShaStepProblems }) => {
      expect(bareShaStepProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 4,
          message: VERSION_ANNOTATION_MESSAGE,
        },
      ]);
    });
  });

  describe("a step pinned to a full commit SHA that carries the version beside it", () => {
    const it = test.extend("annotatedShaStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${PINNED_SHA} # v5\n`,
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves it alone", ({ annotatedShaStepProblems }) => {
      expect(annotatedShaStepProblems).toStrictEqual([]);
    });
  });

  describe("a pinned step annotated with a complete released version", () => {
    const it = test.extend("annotatedShaStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${PINNED_SHA} # v5.1.2-rc.1+build.4\n`,
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("accepts the numeric release tag and its prerelease metadata", ({
      annotatedShaStepProblems,
    }) => {
      expect(annotatedShaStepProblems).toStrictEqual([]);
    });
  });

  describe("pinned steps whose comments do not identify a released version", () => {
    const it = test.extend("problemMessagesByAnnotation", () =>
      ["TODO", "pinned", "v", "vNext", "v5 TODO"].map((annotation) =>
        unpinnedActionRefs({
          document: parseWorkflowDocument({
            relativePath: ".github/workflows/ci.yml",
            source: `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${PINNED_SHA} # ${annotation}\n`,
          }),
          config: defaultWorkflowChecksConfig,
        }).map((problem) => problem.message),
      ));

    it("rejects arbitrary prose and nonnumeric version labels", ({
      problemMessagesByAnnotation,
    }) => {
      expect(problemMessagesByAnnotation).toStrictEqual([
        [VERSION_ANNOTATION_MESSAGE],
        [VERSION_ANNOTATION_MESSAGE],
        [VERSION_ANNOTATION_MESSAGE],
        [VERSION_ANNOTATION_MESSAGE],
        [VERSION_ANNOTATION_MESSAGE],
      ]);
    });
  });

  describe("a step referring to an action of this repository", () => {
    const it = test.extend("localActionStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: ./.github/actions/setup\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves it alone because it moves with this repository", ({ localActionStepProblems }) => {
      expect(localActionStepProblems).toStrictEqual([]);
    });
  });

  describe("a step referring to a container image", () => {
    const it = test.extend("containerImageStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: docker://alpine:3.20\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves it alone", ({ containerImageStepProblems }) => {
      expect(containerImageStepProblems).toStrictEqual([]);
    });
  });

  describe("a job calling a reusable workflow by tag", () => {
    const it = test.extend("reusableWorkflowJobProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    uses: masseater/mst/.github/workflows/guard.yml@v1\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports the job as well as the steps below it", ({ reusableWorkflowJobProblems }) => {
      expect(reusableWorkflowJobProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 3,
          message:
            "An action reference must not end in a tag or a branch, because both move: `masseater/mst/.github/workflows/guard.yml@v1` runs whatever was last pushed under that name, and the change leaves no trace in this repository. Replace the part after `@` with the full 40-character commit SHA it resolves to today, and write the version it stands for beside it as a trailing comment.",
        },
      ]);
    });
  });

  describe("a step whose reference is written without a value", () => {
    const it = test.extend("valuelessStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves it alone rather than reading the empty ref", ({ valuelessStepProblems }) => {
      expect(valuelessStepProblems).toStrictEqual([]);
    });
  });

  describe("a step that declares no reference", () => {
    const it = test.extend("commandStepProblems", () =>
      unpinnedActionRefs({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: vp run guard\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves it alone", ({ commandStepProblems }) => {
      expect(commandStepProblems).toStrictEqual([]);
    });
  });
});
