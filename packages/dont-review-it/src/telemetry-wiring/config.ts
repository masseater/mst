export type TelemetryWiringConfig = {
  readonly toolchainConfigFileName: string;
  readonly measuredBlockFieldName: string;
  readonly wiringFieldPath: readonly string[];
};

export const defaultTelemetryWiringConfig: TelemetryWiringConfig = {
  toolchainConfigFileName: "vite.config.ts",
  measuredBlockFieldName: "test",
  wiringFieldPath: ["experimental", "openTelemetry"],
};
