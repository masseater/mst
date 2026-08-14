import { startTelemetry } from "./telemetry.ts";

export default { shutdown: startTelemetry("mst-test").shutdown };
