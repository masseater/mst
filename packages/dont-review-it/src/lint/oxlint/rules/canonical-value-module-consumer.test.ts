import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { STRICT_RULE } from "./canonical-literal-rule-test-fixture.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());
const consumer = join(repositoryRoot, "packages/dont-review-it/src/lint/oxlint/rules/consumer.ts");
const fixture = "./canonical-literal-owner-exemption.test.ts";

const invalid = (name: string, code: string) => ({
  code,
  cwd: repositoryRoot,
  errors: [{ messageId: "productionImportsOutOfScopeSource" as const }],
  filename: consumer,
  name,
});

const valid = (name: string, code: string) => ({
  code,
  cwd: repositoryRoot,
  filename: consumer,
  name,
});

describe("canonical value module consumers", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      valid(
        "a local Worker constructor is not a module consumer",
        `class Worker { constructor(_source: URL) {} }\nnew Worker(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a shadowed global object Worker is not a module consumer",
        `const globalThis = { Worker: LocalWorker };\nnew globalThis.Worker(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a shadowed window service worker is not a module consumer",
        `const window = { navigator: { serviceWorker: localRegistry } };\nwindow.navigator.serviceWorker.register(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a local worker namespace is not a module consumer",
        `const threads = { Worker: LocalWorker };\nnew threads.Worker(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a local require function cannot manufacture an imported Worker identity",
        `const require = () => ({ Worker: LocalWorker });\nnew (require("node:worker_threads").Worker)(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a shadowed CSS worklet is not a module consumer",
        `const CSS = { paintWorklet: localWorklet };\nCSS.paintWorklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a local importScripts function is not a module consumer",
        `const importScripts = consume;\nimportScripts("${fixture}");`,
      ),
      valid(
        "a shadowed self importScripts function is not a module consumer",
        `const self = { importScripts: consume };\nself.importScripts("${fixture}");`,
      ),
      valid(
        "a local register function is not a module consumer",
        `const register = consume;\nregister(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a local audio worklet shape is not a module consumer",
        `const local = { audioWorklet: { addModule: consume } };\nlocal.audioWorklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a structural audio worklet parameter is not a module consumer",
        `const use = (local: { audioWorklet: { addModule(value: URL): void } }) => local.audioWorklet.addModule(new URL("${fixture}", import.meta.url));\nexport { use };`,
      ),
      valid(
        "a shadowed AudioContext is not a module consumer",
        `class AudioContext { audioWorklet = { addModule: consume }; }\nnew AudioContext().audioWorklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a local child process fork is not a module consumer",
        `const fork = consume;\nfork(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a local child process namespace is not a module consumer",
        `const childProcess = { fork: consume };\nchildProcess.fork(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "a child process executable other than Node does not execute a module",
        `import { spawn } from "node:child_process";\nspawn("echo", [new URL("${fixture}", import.meta.url)]);`,
      ),
      valid(
        "a shadowed process execPath does not identify the Node executable",
        `import { execFile } from "node:child_process";\nconst process = { execPath: "node" };\nexecFile(process.execPath, [new URL("${fixture}", import.meta.url)]);`,
      ),
      valid(
        "a replaced process execPath does not identify the Node executable",
        `import { execFile } from "node:child_process";\nprocess.execPath = "/not-node";\nexecFile(process.execPath, [new URL("${fixture}", import.meta.url)]);`,
      ),
      valid(
        "a later Node argument is not assumed to be a module path",
        `import { spawn } from "node:child_process";\nspawn(process.execPath, ["--eval", "${fixture}"]);`,
      ),
      valid(
        "a local readFileSync function does not consume a repository source",
        `const readFileSync = consume;\nreadFileSync(new URL("${fixture}", import.meta.url));`,
      ),
      valid(
        "reading a numeric file descriptor does not consume a repository source",
        `import { readFileSync } from "node:fs";\nreadFileSync(0, "utf8");`,
      ),
      valid(
        "reading a production source remains allowed",
        `import { readFileSync } from "node:fs";\nreadFileSync(new URL("./canonical-value-module-consumer.ts", import.meta.url));`,
      ),
    ],
    invalid: [
      invalid(
        "a namespace worker threads import cannot load a fixture Worker",
        `import * as threads from "node:worker_threads";\nnew threads.Worker(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a required worker threads namespace cannot load a fixture Worker",
        `declare const require: NodeRequire;\nconst threads = require("node:worker_threads");\nnew threads.Worker(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a destructured required worker threads constructor cannot load a fixture",
        `declare const require: NodeRequire;\nconst { Worker: ThreadWorker } = require("node:worker_threads");\nnew ThreadWorker(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "an aliased named worker threads import cannot load a fixture",
        `import { Worker as ThreadWorker } from "node:worker_threads";\nnew ThreadWorker(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "an aliased worker threads binding cannot load a fixture",
        `import { Worker } from "node:worker_threads";\nconst ThreadWorker = Worker;\nnew ThreadWorker(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "globalThis Worker cannot load a fixture",
        `new globalThis.Worker(new URL("${fixture}", import.meta.url), { type: "module" });`,
      ),
      invalid(
        "globalThis SharedWorker cannot load a fixture",
        `new globalThis.SharedWorker(new URL("${fixture}", import.meta.url), { type: "module" });`,
      ),
      invalid(
        "window Worker cannot load a fixture",
        `new window.Worker(new URL("${fixture}", import.meta.url), { type: "module" });`,
      ),
      invalid(
        "self Worker cannot load a fixture",
        `new self.Worker(new URL("${fixture}", import.meta.url), { type: "module" });`,
      ),
      invalid(
        "globalThis service worker registration cannot load a fixture",
        `globalThis.navigator.serviceWorker.register(new URL("${fixture}", import.meta.url), { type: "module" });`,
      ),
      invalid(
        "window service worker registration cannot load a fixture",
        `window.navigator.serviceWorker.register(new URL("${fixture}", import.meta.url), { type: "module" });`,
      ),
      invalid(
        "globalThis paint worklet cannot load a fixture",
        `globalThis.CSS.paintWorklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      invalid("importScripts cannot load a fixture", `importScripts("${fixture}");`),
      invalid("self importScripts cannot load a fixture", `self.importScripts("${fixture}");`),
      invalid(
        "globalThis importScripts cannot load a fixture",
        `globalThis.importScripts("${fixture}");`,
      ),
      invalid(
        "a named node module register cannot load a fixture",
        `import { register } from "node:module";\nregister(new URL("${fixture}", import.meta.url), import.meta.url);`,
      ),
      invalid(
        "a namespace node module register cannot load a fixture",
        `import * as Module from "node:module";\nModule.register(new URL("${fixture}", import.meta.url), import.meta.url);`,
      ),
      invalid(
        "an aliased node module register cannot load a fixture",
        `import { register as install } from "node:module";\nconst use = install;\nuse(new URL("${fixture}", import.meta.url), import.meta.url);`,
      ),
      invalid(
        "an AudioContext worklet cannot load a fixture",
        `new AudioContext().audioWorklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "an OfflineAudioContext binding worklet cannot load a fixture",
        `const context = new OfflineAudioContext(1, 1, 44_100);\ncontext.audioWorklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "an AudioContext parameter worklet cannot load a fixture",
        `const use = (context: AudioContext) => context.audioWorklet.addModule(new URL("${fixture}", import.meta.url));\nexport { use };`,
      ),
      invalid(
        "an ambient Worklet cannot load a fixture",
        `declare const worklet: Worklet;\nworklet.addModule(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a named child process fork cannot load a fixture",
        `import { fork } from "node:child_process";\nfork(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a namespace child process fork cannot load a fixture",
        `import * as childProcess from "node:child_process";\nchildProcess.fork(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a required child process fork cannot load a fixture",
        `declare const require: NodeRequire;\nconst { fork } = require("node:child_process");\nfork(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "an aliased child process fork cannot load a fixture",
        `import { fork } from "node:child_process";\nconst launch = fork;\nlaunch(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a called child process fork cannot load a fixture",
        `import { fork } from "node:child_process";\nfork.call(undefined, new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "an applied child process fork cannot load a fixture",
        `import { fork } from "node:child_process";\nfork.apply(undefined, [new URL("${fixture}", import.meta.url)]);`,
      ),
      invalid(
        "a bound child process fork cannot load a fixture",
        `import { fork } from "node:child_process";\nconst launch = fork.bind(undefined);\nlaunch(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "a default child process import cannot load a fixture",
        `import childProcess from "node:child_process";\nchildProcess.fork(new URL("${fixture}", import.meta.url));`,
      ),
      invalid(
        "child process execFile cannot execute a fixture with Node",
        `import { execFile } from "node:child_process";\nexecFile(process.execPath, [new URL("${fixture}", import.meta.url)]);`,
      ),
      invalid(
        "child process execFileSync cannot execute a fixture with Node",
        `import { execFileSync } from "node:child_process";\nexecFileSync(process.execPath, [new URL("${fixture}", import.meta.url)]);`,
      ),
      invalid(
        "child process spawn cannot execute a fixture with Node",
        `import * as childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, [new URL("${fixture}", import.meta.url)]);`,
      ),
      invalid(
        "child process spawnSync cannot execute a fixture with Node",
        `declare const require: NodeRequire;\nconst { spawnSync } = require("node:child_process");\nspawnSync(process.execPath, [new URL("${fixture}", import.meta.url)]);`,
      ),
      invalid(
        "a named file read cannot consume a fixture",
        `import { readFileSync } from "node:fs";\nreadFileSync(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a namespace file read cannot consume a fixture",
        `import * as fs from "node:fs";\nfs.readFileSync(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a promise file read cannot consume a fixture",
        `import { readFile } from "node:fs/promises";\nawait readFile(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a required file read cannot consume a fixture",
        `declare const require: NodeRequire;\nconst { readFileSync } = require("node:fs");\nreadFileSync(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a callback file read cannot consume a fixture",
        `import { readFile } from "node:fs";\nreadFile(new URL("${fixture}", import.meta.url), "utf8", consume);`,
      ),
      invalid(
        "a default file system import cannot consume a fixture",
        `import fs from "node:fs";\nfs.readFileSync(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "an imported promises object cannot consume a fixture",
        `import { promises } from "node:fs";\nawait promises.readFile(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a file system namespace promises object cannot consume a fixture",
        `import * as fs from "node:fs";\nawait fs.promises.readFile(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a required promises object cannot consume a fixture",
        `declare const require: NodeRequire;\nawait require("node:fs").promises.readFile(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "an aliased file read cannot consume a fixture",
        `import { readFileSync } from "node:fs";\nconst read = readFileSync;\nread(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a called file read cannot consume a fixture",
        `import { readFileSync } from "node:fs";\nreadFileSync.call(undefined, new URL("${fixture}", import.meta.url), "utf8");`,
      ),
      invalid(
        "a bound file read cannot consume a fixture",
        `import { readFileSync } from "node:fs";\nconst read = readFileSync.bind(undefined);\nread(new URL("${fixture}", import.meta.url), "utf8");`,
      ),
    ],
  });
});
