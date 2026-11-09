const pad = (value: number): string => String(value).padStart(2, '0');

/** Formats a duration in milliseconds as mm:ss (whole seconds, rounded down). */
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));

  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
};

/**
 * Calls `onTick` periodically and returns a function that stops it. Stopping
 * is safe to repeat. The ticks only trigger a redraw: the displayed time is
 * always computed from the start timestamp, never counted tick by tick.
 */
export const startTicker = (
  onTick: () => void,
  periodMs: number,
): (() => void) => {
  const id = setInterval(onTick, periodMs);
  let stopped = false;

  return () => {
    if (!stopped) {
      stopped = true;
      clearInterval(id);
    }
  };
};
