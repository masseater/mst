export const formatElapsed = (milliseconds: number): string => {
  const totalSeconds = milliseconds / 1000;
  if (totalSeconds < 60) {
    return `${(Math.floor(totalSeconds * 10) / 10).toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, "0");
  return `${minutes}m${seconds}s`;
};
