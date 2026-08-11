import { failureCodeOf } from "@mst/utils";

export const isEnvironmentFailure = (failure: unknown): boolean => failureCodeOf(failure) !== null;
