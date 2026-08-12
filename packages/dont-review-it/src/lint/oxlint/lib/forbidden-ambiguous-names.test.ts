import { describe, expect, test } from "vite-plus/test";

import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
  normalizeIdentifierName,
} from "./forbidden-ambiguous-names.ts";

describe("forbidden-ambiguous-names", () => {
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
    expect(isForbidden("value")).toBe(true);
    expect(isForbidden("res")).toBe(true);
    expect(isForbidden("ret")).toBe(true);
    expect(isForbidden("data")).toBe(true);
    expect(isForbidden("actual")).toBe(true);
  });

  test("a placeholder word carries no subject at all", () => {
    expect(isForbidden("temp")).toBe(true);
    expect(isForbidden("tmp")).toBe(true);
    expect(isForbidden("foo")).toBe(true);
    expect(isForbidden("dummy")).toBe(true);
  });

  test("a word naming the container instead of what it holds is forbidden", () => {
    expect(isForbidden("obj")).toBe(true);
    expect(isForbidden("items")).toBe(true);
    expect(isForbidden("entries")).toBe(true);
    expect(isForbidden("payload")).toBe(true);
    expect(isForbidden("content")).toBe(true);
  });

  test("a word naming the mechanism instead of its subject is forbidden", () => {
    expect(isForbidden("ctx")).toBe(true);
    expect(isForbidden("context")).toBe(true);
    expect(isForbidden("options")).toBe(true);
    expect(isForbidden("handler")).toBe(true);
    expect(isForbidden("callback")).toBe(true);
  });

  test("a word naming the unit of a measurement is forbidden", () => {
    expect(isForbidden("date")).toBe(true);
    expect(isForbidden("time")).toBe(true);
    expect(isForbidden("timestamp")).toBe(true);
    expect(isForbidden("count")).toBe(true);
  });

  test("a subject in front of a measurement word keeps the name concrete", () => {
    expect(isForbidden("expiryDate")).toBe(false);
    expect(isForbidden("startTime")).toBe(false);
  });

  test("a word naming an operation without its subject is forbidden", () => {
    expect(isForbidden("parsed")).toBe(true);
    expect(isForbidden("formatted")).toBe(true);
    expect(isForbidden("merged")).toBe(true);
  });

  test("a plural form falls with its singular", () => {
    expect(isForbidden("vals")).toBe(true);
    expect(isForbidden("values")).toBe(true);
    expect(isForbidden("targets")).toBe(true);
    expect(isForbidden("bodies")).toBe(true);
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
  });

  test("a bag word that is not at the end leaves room for a subject", () => {
    expect(isForbidden("resultCount")).toBe(false);
    expect(isForbidden("outcomeLabel")).toBe(false);
  });

  test("a subject in front of an output word keeps the name concrete", () => {
    expect(isForbidden("gitOutput")).toBe(false);
    expect(isForbidden("userInfo")).toBe(false);
  });

  test("a decoration in front of a forbidden word does not rescue the name", () => {
    expect(isForbidden("theData")).toBe(true);
    expect(isForbidden("newValue")).toBe(true);
    expect(isForbidden("rawArgs")).toBe(true);
    expect(isForbidden("someItems")).toBe(true);
  });

  test("a number after a forbidden word does not rescue the name", () => {
    expect(isForbidden("res2")).toBe(true);
    expect(isForbidden("value1")).toBe(true);
  });

  test("a separator around a forbidden word does not rescue the name", () => {
    expect(isForbidden("_data")).toBe(true);
    expect(isForbidden("$value")).toBe(true);
    expect(isForbidden("__result__")).toBe(true);
  });

  test("a decoration that stands alone is still judged as the whole name", () => {
    expect(isForbidden("current")).toBe(true);
    expect(isForbidden("temp")).toBe(true);
  });

  test("a subject after a decoration survives", () => {
    expect(isForbidden("newPassword")).toBe(false);
    expect(isForbidden("currentUser")).toBe(false);
  });

  test("normalizing strips decorations down to the subject", () => {
    expect(normalizeIdentifierName("theNewData")).toBe("Data");
    expect(normalizeIdentifierName("_res2")).toBe("res");
    expect(normalizeIdentifierName("parseResult")).toBe("parseResult");
  });

  test("normalizing keeps the last word even when every word decorates", () => {
    expect(normalizeIdentifierName("theCurrent")).toBe("Current");
  });

  test("a name with no words at all is judged as nothing", () => {
    expect(isForbidden("__")).toBe(false);
    expect(normalizeIdentifierName("__")).toBe("");
  });

  test("a name made only of digits keeps them", () => {
    expect(normalizeIdentifierName("_2")).toBe("2");
  });

  test("an empty vocabulary forbids nothing", () => {
    expect(createForbiddenNameMatcher([])("data")).toBe(false);
  });
});
