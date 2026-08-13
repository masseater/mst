import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { unboundedHistoryFetches } from "./history-fetch-depth.ts";

describe("unboundedHistoryFetches", () => {
  describe("a checkout that asks for every commit", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n        with:\n          fetch-depth: 0\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports the checkout and tells the reader to read the history through the API instead", ({
      historyFetchProblems,
    }) => {
      expect(historyFetchProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 6,
          message:
            "A checkout must not ask for the whole history, because 0 transfers every commit ever made and that amount grows with the age of the repository rather than with anything this run does. A run that was fast when the rule was written gets slower every month while its definition stays the same. Read the history through the GitHub API instead and leave `fetch-depth` at a bounded number: compare two refs to decide whether one descends from the other, list commits between two points, and read tags through the refs endpoint. Each of those answers one question in one request. Deepening the clone afterwards or fetching without blobs keeps the transfer tied to the size of the repository and is not a way out of this.",
        },
      ]);
    });
  });

  describe("a checkout that writes the same request as a string", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            'jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n        with:\n          fetch-depth: "0"\n',
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports the quoted depth the same way as the number", ({ historyFetchProblems }) => {
      expect(historyFetchProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 6,
          message:
            "A checkout must not ask for the whole history, because 0 transfers every commit ever made and that amount grows with the age of the repository rather than with anything this run does. A run that was fast when the rule was written gets slower every month while its definition stays the same. Read the history through the GitHub API instead and leave `fetch-depth` at a bounded number: compare two refs to decide whether one descends from the other, list commits between two points, and read tags through the refs endpoint. Each of those answers one question in one request. Deepening the clone afterwards or fetching without blobs keeps the transfer tied to the size of the repository and is not a way out of this.",
        },
      ]);
    });
  });

  describe("a checkout that asks for every commit in another workflow file", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/release.yml",
          source:
            "jobs:\n  publish:\n    steps:\n      - uses: actions/checkout\n        with:\n          fetch-depth: 0\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("names the workflow file the checkout was written in", ({ historyFetchProblems }) => {
      expect(historyFetchProblems).toStrictEqual([
        {
          file: ".github/workflows/release.yml",
          line: 6,
          message:
            "A checkout must not ask for the whole history, because 0 transfers every commit ever made and that amount grows with the age of the repository rather than with anything this run does. A run that was fast when the rule was written gets slower every month while its definition stays the same. Read the history through the GitHub API instead and leave `fetch-depth` at a bounded number: compare two refs to decide whether one descends from the other, list commits between two points, and read tags through the refs endpoint. Each of those answers one question in one request. Deepening the clone afterwards or fetching without blobs keeps the transfer tied to the size of the repository and is not a way out of this.",
        },
      ]);
    });
  });

  describe("a checkout that writes the depth behind another input", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n        with:\n          ref: main\n          fetch-depth: 0\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("points at the line the depth was written on", ({ historyFetchProblems }) => {
      expect(historyFetchProblems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 7,
          message:
            "A checkout must not ask for the whole history, because 0 transfers every commit ever made and that amount grows with the age of the repository rather than with anything this run does. A run that was fast when the rule was written gets slower every month while its definition stays the same. Read the history through the GitHub API instead and leave `fetch-depth` at a bounded number: compare two refs to decide whether one descends from the other, list commits between two points, and read tags through the refs endpoint. Each of those answers one question in one request. Deepening the clone afterwards or fetching without blobs keeps the transfer tied to the size of the repository and is not a way out of this.",
        },
      ]);
    });
  });

  describe("a checkout that asks for a bounded depth", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n        with:\n          fetch-depth: 2\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves a bounded depth alone", ({ historyFetchProblems }) => {
      expect(historyFetchProblems).toStrictEqual([]);
    });
  });

  describe("a checkout that says nothing about the depth", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n        with:\n          ref: main\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves a checkout that says nothing about the depth alone", ({ historyFetchProblems }) => {
      expect(historyFetchProblems).toStrictEqual([]);
    });
  });

  describe("a step that passes no inputs", () => {
    const it = test.extend("historyFetchProblems", () =>
      unboundedHistoryFetches({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - uses: actions/checkout\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("leaves a step that passes no inputs alone", ({ historyFetchProblems }) => {
      expect(historyFetchProblems).toStrictEqual([]);
    });
  });
});
