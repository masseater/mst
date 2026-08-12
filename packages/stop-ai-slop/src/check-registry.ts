import { noRemovalVerification } from "./checks/no-removal-verification.ts";

import type { SlopCheck } from "./check.ts";

export const CHECKS: readonly SlopCheck[] = [noRemovalVerification];
