import { expect, test } from "vite-plus/test";

import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
} from "./forbidden-ambiguous-names.ts";

const isForbidden = createForbiddenNameMatcher(FORBIDDEN_AMBIGUOUS_NAMES);

test("a word meaning a bag of consequences is forbidden on its own", () => {
  expect(isForbidden("outcome")).toBe(true);
  expect(isForbidden("result")).toBe(true);
});

test("a word meaning a bag of consequences is forbidden as a suffix too", () => {
  expect(isForbidden("queryOutcome")).toBe(true);
  expect(isForbidden("parseResult")).toBe(true);
  expect(isForbidden("validation_result")).toBe(true);
});

test("an abbreviation or a container word is forbidden as the whole name", () => {
  expect(isForbidden("val")).toBe(true);
  expect(isForbidden("vals")).toBe(true);
  expect(isForbidden("value")).toBe(true);
  expect(isForbidden("values")).toBe(true);
  expect(isForbidden("res")).toBe(true);
  expect(isForbidden("ret")).toBe(true);
  expect(isForbidden("data")).toBe(true);
  expect(isForbidden("actual")).toBe(true);
});

test("matching ignores the case the name was written in", () => {
  expect(isForbidden("Data")).toBe(true);
  expect(isForbidden("VALUES")).toBe(true);
  expect(isForbidden("parsedRESULT")).toBe(true);
});

test("a name that only contains a container word keeps its subject", () => {
  expect(isForbidden("interval")).toBe(false);
  expect(isForbidden("defaultValue")).toBe(false);
  expect(isForbidden("metadata")).toBe(false);
  expect(isForbidden("dataset")).toBe(false);
  expect(isForbidden("resource")).toBe(false);
  expect(isForbidden("retry")).toBe(false);
  expect(isForbidden("actualCount")).toBe(false);
});

test("a bag word that is not at the end leaves room for a subject", () => {
  expect(isForbidden("resultCount")).toBe(false);
  expect(isForbidden("outcomeLabel")).toBe(false);
});

test("an empty vocabulary forbids nothing", () => {
  expect(createForbiddenNameMatcher([])("data")).toBe(false);
});
