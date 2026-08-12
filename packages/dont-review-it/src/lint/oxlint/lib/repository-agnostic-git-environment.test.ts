import { describe, expect, test } from "vite-plus/test";

import { repositoryAgnosticGitEnvironment } from "./repository-agnostic-git-environment.ts";

describe("repositoryAgnosticGitEnvironment", () => {
  test("only repository-local Git variables are removed from a subprocess environment", () => {
    expect(
      repositoryAgnosticGitEnvironment({
        GIT_ALTERNATE_OBJECT_DIRECTORIES: "alternate-objects",
        GIT_COMMON_DIR: "common",
        GIT_CONFIG: "config",
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_PARAMETERS: "'feature.enabled'='true'",
        GIT_DIR: "repository",
        GIT_GRAFT_FILE: "grafts",
        GIT_IMPLICIT_WORK_TREE: "1",
        GIT_INDEX_FILE: "index",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_OBJECT_DIRECTORY: "objects",
        GIT_PREFIX: "prefix",
        GIT_REPLACE_REF_BASE: "refs/replace/",
        GIT_SHALLOW_FILE: "shallow",
        GIT_WORK_TREE: "worktree",
        HTTPS_PROXY: "https://proxy.example.invalid",
        USERPROFILE: "C:\\Users\\fixture",
        VP_HOME: "/opt/vite-plus",
      }),
    ).toStrictEqual({
      HTTPS_PROXY: "https://proxy.example.invalid",
      USERPROFILE: "C:\\Users\\fixture",
      VP_HOME: "/opt/vite-plus",
    });
  });
});
