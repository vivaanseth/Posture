import {
  ArrowRight,
  CheckCircle,
  Gauge,
  VideoCamera,
} from "@phosphor-icons/react";
import { CameraPreview } from "../components/CameraPreview";
import type { CameraDevice } from "../hooks/useTrackingController";
import type {
  RuntimeDiagnostics,
  TrackingSnapshot,
} from "../../../shared/contracts";

export function Diagnostics({
  stream,
  devices,
  selectedCameraId,
  snapshot,
  calibrating,
  progress,
  error,
  workerReady,
  diagnosticsEnabled,
  diagnostics,
  onSelectCamera,
  onOpenCamera,
  onCalibrate,
  onCancelCalibration,
}: {
  stream: MediaStream | null;
  devices: CameraDevice[];
  selectedCameraId: string | null;
  snapshot: TrackingSnapshot;
  calibrating: boolean;
  progress: number;
  error: string | null;
  workerReady: boolean;
  diagnosticsEnabled: boolean;
  diagnostics: RuntimeDiagnostics;
  onSelectCamera: (id: string) => void;
  onOpenCamera: () => void;
  onCalibrate: () => void;
  onCancelCalibration: () => void;
}): React.JSX.Element {
  const selectedCamera = devices.find(
    (device) => device.deviceId === selectedCameraId,
  );
  const framingState = !stream
    ? "Preview is off"
    : snapshot.state === "away" || snapshot.state === "unknown"
      ? "Adjust your framing"
      : snapshot.confidence >= 0.65
        ? "Framing looks good"
        : "Checking framing";

  return (
    <section className="screen camera-screen" aria-labelledby="camera-title">
      <div className="camera-copy">
        <span className="context-label">Camera</span>
        <h1 id="camera-title" tabIndex={-1}>
          Check your
          <br />
          framing.
        </h1>
        <p>
          Make sure your face and shoulders are visible before recalibrating.
        </p>

        <label className="camera-device-card">
          <span className="status-dot" aria-hidden="true" />
          <span>
            <strong>{selectedCamera?.label ?? "Current camera"}</strong>
            <small>
              {stream ? "Preview active · local only" : "Preview off"}
            </small>
          </span>
          <select
            aria-label="Current camera"
            value={selectedCameraId ?? ""}
            onChange={(event) => onSelectCamera(event.target.value)}
          >
            <option value="" disabled>
              Select a camera
            </option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>

        {!stream && (
          <button className="camera-action neutral" onClick={onOpenCamera}>
            <span>
              <strong>Open camera preview</strong>
              <small>Video remains on this device.</small>
            </span>
            <VideoCamera size={18} aria-hidden="true" />
          </button>
        )}

        <button
          className="camera-action"
          disabled={!stream || calibrating || !workerReady}
          onClick={onCalibrate}
        >
          <span>
            <strong>
              {calibrating ? "Recalibrating baseline" : "Recalibrate baseline"}
            </strong>
            <small>
              {calibrating
                ? `${progress}% complete · keep sitting naturally`
                : "Sit naturally for about 10 seconds."}
            </small>
          </span>
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </button>

        {calibrating && (
          <>
            <div
              className="calibration-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={`Calibration ${progress}% complete`}
            >
              <span
                style={
                  {
                    "--progress-scale": progress / 100,
                  } as React.CSSProperties
                }
              />
            </div>
            <button className="text-button" onClick={onCancelCalibration}>
              Cancel calibration
            </button>
          </>
        )}

        {error && (
          <p id="camera-error" className="inline-error" role="alert">
            {error}
          </p>
        )}

        <p className="camera-privacy-note">
          Nothing is uploaded or saved as video.
        </p>

        {diagnosticsEnabled ? (
          <details className="advanced-diagnostics">
            <summary>Advanced diagnostics</summary>
            <div className="diagnostic-readout">
              <div>
                <Gauge size={17} aria-hidden="true" />
                <span>Model</span>
                <strong>{workerReady ? "Ready" : "Loading"}</strong>
              </div>
              <div>
                <CheckCircle size={17} aria-hidden="true" />
                <span>Landmark confidence</span>
                <strong>{Math.round(snapshot.confidence * 100)}%</strong>
              </div>
              <div>
                <VideoCamera size={17} aria-hidden="true" />
                <span>Inference</span>
                <strong>
                  {snapshot.inferenceMs === null
                    ? "Idle"
                    : `${Math.round(snapshot.inferenceMs)} ms`}
                </strong>
              </div>
              <div>
                <Gauge size={17} aria-hidden="true" />
                <span>Sampling</span>
                <strong>
                  {diagnostics.measuredFps.toFixed(1)} / {diagnostics.targetFps}{" "}
                  FPS
                </strong>
              </div>
            </div>
          </details>
        ) : (
          <p className="diagnostics-hidden-note">
            Advanced diagnostics are hidden by default.
          </p>
        )}
      </div>

      <div className="camera-preview-panel">
        <CameraPreview stream={stream} />
        <span
          className={`framing-status ${framingState === "Framing looks good" ? "ready" : "checking"}`}
          role="status"
        >
          <i aria-hidden="true" />
          {framingState}
        </span>
      </div>
    </section>
  );
}
