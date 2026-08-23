import { useMemo } from "react";

export type SessionTraceState = "comfortable" | "drifting" | "away";

export interface SessionTracePoint {
  /** Milliseconds from the beginning of the session. */
  elapsedMs: number;
  /** Normalized displacement from the personal baseline, from 0 to 1. */
  value: number;
  state: SessionTraceState;
}

export interface SessionTraceProps {
  points: readonly SessionTracePoint[];
  /** Total session duration. Defaults to the latest supplied point. */
  durationMs?: number;
  ariaLabel?: string;
  emptyLabel?: string;
  showLegend?: boolean;
  className?: string;
}

const stateLabels: Record<SessionTraceState, string> = {
  comfortable: "Comfortable",
  drifting: "Drifting",
  away: "Away",
};

interface TraceBand {
  key: string;
  state: SessionTraceState;
  start: number;
  end: number;
}

const mergeBands = (
  points: readonly SessionTracePoint[],
  durationMs: number,
): TraceBand[] => {
  if (points.length === 0) return [];

  const bands: TraceBand[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const start = Math.min(durationMs, Math.max(0, point.elapsedMs));
    const end = Math.max(
      start,
      Math.min(durationMs, next?.elapsedMs ?? durationMs),
    );
    const previous = bands.at(-1);

    if (previous?.state === point.state && previous.end === start) {
      previous.end = end;
    } else {
      bands.push({
        key: `${start}-${point.state}-${index}`,
        state: point.state,
        start,
        end,
      });
    }
  }

  return bands;
};

export function SessionTrace({
  points,
  durationMs,
  ariaLabel = "Session posture trace",
  emptyLabel = "Your session trace will appear as tracking continues.",
  showLegend = true,
  className,
}: SessionTraceProps): React.JSX.Element {
  const orderedPoints = useMemo(
    () =>
      [...points]
        .filter(
          (point) =>
            Number.isFinite(point.elapsedMs) &&
            point.elapsedMs >= 0 &&
            Number.isFinite(point.value),
        )
        .sort((a, b) => a.elapsedMs - b.elapsedMs),
    [points],
  );
  const latestElapsedMs = orderedPoints.at(-1)?.elapsedMs ?? 0;
  const requestedDurationMs = Number.isFinite(durationMs)
    ? Math.max(0, durationMs ?? 0)
    : latestElapsedMs;
  const traceDurationMs = Math.max(requestedDurationMs, latestElapsedMs, 1);
  const bands = mergeBands(orderedPoints, traceDurationMs);
  const classes = ["session-trace", className].filter(Boolean).join(" ");

  if (orderedPoints.length === 0) {
    return (
      <div className={`${classes} session-trace--empty`}>
        <p className="session-trace-empty-label">{emptyLabel}</p>
        {showLegend ? <TraceLegend /> : null}
      </div>
    );
  }

  return (
    <figure className={classes} aria-label={ariaLabel}>
      <div className="session-trace-bar" aria-hidden="true">
        {bands.map((band) => (
          <span
            key={band.key}
            className={`session-trace-segment session-trace-segment--${band.state}`}
            style={{
              left: `${(band.start / traceDurationMs) * 100}%`,
              width: `${Math.max(0.8, ((band.end - band.start) / traceDurationMs) * 100)}%`,
            }}
          />
        ))}
      </div>
      {showLegend ? <TraceLegend /> : null}
    </figure>
  );
}

function TraceLegend(): React.JSX.Element {
  return (
    <ul className="session-trace-legend" aria-label="Trace legend">
      {(Object.keys(stateLabels) as SessionTraceState[]).map((state) => (
        <li key={state} className={`session-trace-legend-item state-${state}`}>
          <span
            className={`session-trace-legend-swatch session-trace-legend-swatch--${state}`}
            aria-hidden="true"
          />
          <span>{stateLabels[state]}</span>
        </li>
      ))}
    </ul>
  );
}
