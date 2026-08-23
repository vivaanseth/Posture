import { Pause, Play, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CameraFailureCode,
  PostureState,
  SessionSummary,
  TrackingMode,
  TrackingSnapshot,
} from "../../../shared/contracts";
import {
  PostureVisualization,
  type PostureVisualizationState,
} from "../components/PostureVisualization";
import {
  SessionTrace,
  type SessionTracePoint,
} from "../components/SessionTrace";

type LiveUiState =
  | "good"
  | "drifting"
  | "needs-attention"
  | "recovering"
  | "back-in-range"
  | "paused"
  | "unavailable";

const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const exactPercentages = (values: number[]): number[] => {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((value) => (value / total) * 100);
  const rounded = raw.map(Math.floor);
  let remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, remainder: value - rounded[index] }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (remaining <= 0) return;
      rounded[index] += 1;
      remaining -= 1;
    });
  return rounded;
};

const postureBand = (state: PostureState): SessionTracePoint["state"] =>
  state === "good" ? "comfortable" : state === "caution" ? "drifting" : "away";

const copyForState: Record<
  LiveUiState,
  { eyebrow: string; title: string; body: string; visual: string }
> = {
  good: {
    eyebrow: "Current posture",
    title: "Good posture",
    body: "You’re close to your comfortable baseline.",
    visual: "Aligned",
  },
  drifting: {
    eyebrow: "Current posture",
    title: "A little drift",
    body: "You’re moving away from your baseline, but no reset is needed yet.",
    visual: "Drifting",
  },
  "needs-attention": {
    eyebrow: "Current posture",
    title: "Time to reset",
    body: "You’ve been outside your baseline for a little while.",
    visual: "Drifting",
  },
  recovering: {
    eyebrow: "Current posture",
    title: "Almost there",
    body: "You’re moving back toward your comfortable range.",
    visual: "Recovering",
  },
  "back-in-range": {
    eyebrow: "Current posture",
    title: "Back in range",
    body: "You’re back inside your comfortable range.",
    visual: "Back in range",
  },
  paused: {
    eyebrow: "Current posture",
    title: "Tracking paused",
    body: "Start when you’re ready for a focused session.",
    visual: "Paused",
  },
  unavailable: {
    eyebrow: "Current posture",
    title: "Step into view",
    body: "Make sure your head and shoulders are visible.",
    visual: "Waiting for a clear view",
  },
};

export function Dashboard({
  snapshot,
  session,
  trackingMode,
  reminderDelaySeconds,
  cameraError,
  cameraFailureCode,
  cameraId,
  hasCalibration,
  onToggle,
  onDiagnostics,
  onRetryCamera,
  onRecalibrate,
}: {
  snapshot: TrackingSnapshot;
  session: SessionSummary | null;
  trackingMode: TrackingMode;
  reminderDelaySeconds: number;
  cameraError: string | null;
  cameraFailureCode: CameraFailureCode | null;
  cameraId: string | null;
  hasCalibration: boolean;
  onToggle: () => void;
  onDiagnostics: () => void;
  onRetryCamera: () => void;
  onRecalibrate: () => void;
}): React.JSX.Element {
  const activeDuration =
    (session?.trackedMs ?? 0) +
    (session?.unknownMs ?? 0) +
    (session?.awayMs ?? 0);
  const [comfortable, drifting, away] = exactPercentages([
    session?.goodMs ?? 0,
    session?.cautionMs ?? 0,
    (session?.poorMs ?? 0) + (session?.unknownMs ?? 0) + (session?.awayMs ?? 0),
  ]);
  const canPause = ["tracking", "recovering"].includes(trackingMode);
  const [uiState, setUiState] = useState<LiveUiState>(
    trackingMode === "tracking" ? "good" : "paused",
  );
  const uiStateRef = useRef(uiState);
  const poorSinceRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const previousSessionIdRef = useRef<string | null>(session?.id ?? null);
  const [tracePoints, setTracePoints] = useState<SessionTracePoint[]>([]);

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(
    () => () => {
      if (successTimerRef.current !== null)
        window.clearTimeout(successTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (trackingMode !== "tracking") {
      poorSinceRef.current = null;
      setUiState(
        snapshot.state === "unknown" || snapshot.state === "away"
          ? "unavailable"
          : "paused",
      );
      return;
    }

    if (snapshot.state === "unknown" || snapshot.state === "away") {
      poorSinceRef.current = null;
      setUiState("unavailable");
      return;
    }

    if (snapshot.state === "poor") {
      const now = snapshot.timestamp || Date.now();
      poorSinceRef.current ??= now;
      const sustainedFor = Math.max(0, now - poorSinceRef.current);
      setUiState(
        sustainedFor >= reminderDelaySeconds * 1_000
          ? "needs-attention"
          : "drifting",
      );
      return;
    }

    if (snapshot.state === "caution") {
      poorSinceRef.current = null;
      setUiState(
        uiStateRef.current === "needs-attention" ||
          uiStateRef.current === "recovering"
          ? "recovering"
          : "drifting",
      );
      return;
    }

    if (snapshot.state === "good") {
      poorSinceRef.current = null;
      const shouldCelebrate =
        uiStateRef.current === "needs-attention" ||
        uiStateRef.current === "recovering";
      if (shouldCelebrate) {
        setUiState("back-in-range");
        if (successTimerRef.current !== null)
          window.clearTimeout(successTimerRef.current);
        successTimerRef.current = window.setTimeout(
          () => setUiState("good"),
          2_400,
        );
      } else if (uiStateRef.current !== "back-in-range") {
        setUiState("good");
      }
    }
  }, [reminderDelaySeconds, snapshot.state, snapshot.timestamp, trackingMode]);

  useEffect(() => {
    if (previousSessionIdRef.current !== (session?.id ?? null)) {
      previousSessionIdRef.current = session?.id ?? null;
      setTracePoints([]);
    }
    if (
      trackingMode !== "tracking" ||
      !session ||
      !["good", "caution", "poor", "unknown", "away"].includes(snapshot.state)
    )
      return;
    const elapsedMs = Math.max(
      0,
      Date.now() - new Date(session.startedAt).getTime(),
    );
    const value =
      snapshot.score === null ? 1 : Math.max(0, (100 - snapshot.score) / 100);
    const point: SessionTracePoint = {
      elapsedMs,
      value,
      state: postureBand(snapshot.state),
    };
    setTracePoints((points) => {
      const last = points.at(-1);
      if (
        last &&
        elapsedMs - last.elapsedMs < 1_000 &&
        last.state === point.state
      )
        return points;
      return [...points.slice(-179), point];
    });
  }, [
    session,
    snapshot.score,
    snapshot.state,
    snapshot.timestamp,
    trackingMode,
  ]);

  const copy = copyForState[uiState];
  const liveStatus =
    uiState === "paused"
      ? "Paused"
      : uiState === "unavailable"
        ? "Checking framing"
        : uiState === "back-in-range"
          ? "Back in range"
          : uiState === "recovering"
            ? "Recovering"
            : uiState === "needs-attention" || uiState === "drifting"
              ? "Drifting"
              : "Aligned";
  const visualState: PostureVisualizationState =
    uiState === "recovering"
      ? "recovering"
      : uiState === "back-in-range"
        ? "back-in-range"
        : uiState === "needs-attention"
          ? "poor"
          : uiState === "drifting"
            ? "caution"
            : "good";
  const offset = useMemo(() => {
    const distance =
      snapshot.score === null ? 0 : Math.max(0, (100 - snapshot.score) / 100);
    return {
      x:
        visualState === "good" || visualState === "back-in-range"
          ? 0.02
          : distance,
      y: visualState === "poor" ? distance * 0.35 : distance * 0.12,
    };
  }, [snapshot.score, visualState]);

  return (
    <section
      className={`screen dashboard-screen live-state-${uiState}`}
      aria-labelledby="dashboard-title"
    >
      <header className="live-topbar">
        <span className="wordmark">Upright</span>
        <div className="session-controls">
          <span className="session-clock">
            Session&nbsp;&nbsp;{formatDuration(activeDuration)}
          </span>
          <button
            className="button button-secondary compact"
            onClick={onToggle}
            disabled={
              trackingMode === "requesting-permission" ||
              trackingMode === "calibrating"
            }
          >
            {canPause ? (
              <Pause size={14} weight="bold" aria-hidden="true" />
            ) : (
              <Play size={14} weight="fill" aria-hidden="true" />
            )}
            {canPause ? "Pause" : "Start"}
          </button>
        </div>
      </header>

      {(cameraError || trackingMode === "recovering" || !hasCalibration) && (
        <div className="recovery-banner camera-recovery" role="alert">
          <WarningCircle size={19} aria-hidden="true" />
          <div>
            <strong>
              {trackingMode === "recovering"
                ? "Reconnecting to your camera"
                : !hasCalibration
                  ? "This camera needs calibration"
                  : cameraFailureCode === "permission-denied" ||
                      cameraFailureCode === "permission-restricted"
                    ? "Camera access needs attention"
                    : "Camera tracking needs attention"}
            </strong>
            <p>
              {cameraError ??
                (trackingMode === "recovering"
                  ? "Upright is retrying the same camera."
                  : `Calibrate ${cameraId ? "the selected camera" : "a camera"} before starting.`)}
            </p>
          </div>
          <div className="recovery-actions">
            {cameraError && (
              <button className="text-button" onClick={onRetryCamera}>
                Retry
              </button>
            )}
            <button className="text-button" onClick={onDiagnostics}>
              Camera
            </button>
            <button className="text-button" onClick={onRecalibrate}>
              Recalibrate
            </button>
          </div>
        </div>
      )}

      <div className="live-layout">
        <div className="live-summary">
          <span className="context-label">{copy.eyebrow}</span>
          <h1 id="dashboard-title" tabIndex={-1}>
            {copy.title}
          </h1>
          <p className="live-body">{copy.body}</p>
          <div className="live-rule" />

          <div
            className="session-breakdown"
            aria-label="Session posture breakdown"
          >
            <div className="primary-metric">
              <strong>{comfortable}%</strong>
              <span>comfortable this session</span>
            </div>
            <div>
              <strong>{drifting}%</strong>
              <span>drifting</span>
            </div>
            <div>
              <strong>{away}%</strong>
              <span>away</span>
            </div>
          </div>

          <div className="trace-section">
            <span className="context-label">Session trace</span>
            <SessionTrace
              points={tracePoints}
              durationMs={activeDuration}
              emptyLabel="Your live trace will appear as tracking continues."
            />
            <p>
              {uiState === "needs-attention"
                ? `You’ve drifted for ${reminderDelaySeconds}s — move however feels comfortable.`
                : uiState === "recovering"
                  ? "Almost there — keep moving naturally."
                  : uiState === "back-in-range"
                    ? "Nice — no need to hold still."
                    : "Move naturally. Upright only nudges after a sustained change."}
            </p>
            <span className="nudge-count">
              {session?.reminderCount ?? 0} gentle{" "}
              {(session?.reminderCount ?? 0) === 1 ? "nudge" : "nudges"} this
              session
            </span>
          </div>
        </div>

        <div className="live-posture-field">
          <span
            className={`live-status status-${uiState === "paused" || uiState === "unavailable" ? uiState : visualState}`}
          >
            <i aria-hidden="true" />
            {uiState === "paused" ? "Session · " : "Live · "}
            {liveStatus}
          </span>
          <PostureVisualization
            state={visualState}
            offset={offset}
            label={`${copy.visual}. ${copy.body}`}
          />
          <div className="visual-copy">
            <strong>{copy.visual}</strong>
            <span>
              {uiState === "recovering"
                ? "moving toward baseline"
                : uiState === "back-in-range"
                  ? "comfortable again"
                  : uiState === "needs-attention" || uiState === "drifting"
                    ? "outside your baseline"
                    : uiState === "unavailable"
                      ? "waiting for a clear view"
                      : "within your baseline"}
            </span>
          </div>
          <div className="visual-legend" aria-hidden="true">
            <span className="baseline-key">baseline</span>
            <span className="live-key">live posture</span>
          </div>
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {copy.title}. {copy.body}
      </p>
    </section>
  );
}
