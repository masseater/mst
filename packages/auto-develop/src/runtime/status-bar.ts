export type StatusSnapshot = {
  readonly mode: string;
  readonly engineCommand: string;
  readonly connected: boolean;
  readonly runningLanes: readonly string[];
  readonly waitingLanes: readonly string[];
  readonly uptimeMs: number;
};

const clipToWidth = (line: string, width: number): string =>
  line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`;

export const formatUptime = (uptimeMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(uptimeMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const padded = (value: number): string => String(value).padStart(2, "0");
  return `${padded(hours)}:${padded(minutes)}:${padded(seconds)}`;
};

export const renderStatusBar = (render: {
  readonly snapshot: StatusSnapshot;
  readonly width: number;
}): readonly string[] => {
  const { snapshot } = render;
  const lanes = (labels: readonly string[]): string =>
    labels.length === 0 ? "none" : labels.join(" ");
  return [
    `[${snapshot.mode}] ${snapshot.engineCommand} — ${snapshot.connected ? "connected" : "reconnecting"} — up ${formatUptime(snapshot.uptimeMs)}`,
    `running: ${lanes(snapshot.runningLanes)}`,
    `waiting: ${lanes(snapshot.waitingLanes)}`,
  ].map((line) => clipToWidth(line, render.width));
};
