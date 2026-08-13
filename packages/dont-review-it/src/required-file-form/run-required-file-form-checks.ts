import { agentInstructionLinksIn } from "./agent-instruction-links.ts";
import { foreignToolConfigsIn } from "./foreign-tool-configs.ts";
import { packageRootsIn } from "./package-roots.ts";

import type { ScannedProblems } from "@mst/repository-checks";
import type { RequiredFileFormConfig } from "./config.ts";

export const runRequiredFileFormChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: RequiredFileFormConfig;
}): ScannedProblems => {
  const packageRoots = packageRootsIn(repositoryRoot);

  return {
    problems: packageRoots.flatMap((packageRoot) => [
      ...foreignToolConfigsIn({ repositoryRoot, packageRoot, config }),
      ...agentInstructionLinksIn({ repositoryRoot, packageRoot, config }),
    ]),
    scanned: packageRoots.length,
  };
};
