import { failureCodeOf } from "@mst/repository-checks";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;
