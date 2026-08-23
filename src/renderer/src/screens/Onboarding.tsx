import { ArrowLeft, ArrowRight, Check, LockKey } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type {
  CameraAccessStatus,
  CameraFailureCode,
} from "../../../shared/contracts";
import { CameraPreview } from "../components/CameraPreview";
import type { CameraDevice } from "../hooks/useTrackingController";

const cameraFailureMessage: Record<CameraFailureCode, string> = {
  "permission-denied": "Camera permission is denied.",
  "permission-restricted": "Camera access is restricted by this system.",
  "no-device": "No camera was found.",
  "device-busy": "The selected camera is busy in another application.",
  "device-disconnected": "The selected camera was disconnected.",
  unsupported: "Camera access is not supported on this system.",
  "playback-failed": "The camera opened, but its preview could not start.",
  "worker-init-failed": "The local posture model could not load.",
  unknown: "Upright could not open the selected camera.",
};

export function Onboarding({
  stream,
  devices,
  selectedCameraId,
  progress,
  calibrating,
  cameraAccessStatus,
  cameraFailureCode,
  workerReady,
  canOpenCameraSettings,
  error,
  hasCalibration,
  onOpenCamera,
  onCloseCamera,
  onOpenCameraSettings,
  onSelectCamera,
  onCalibrate,
  onCancelCalibration,
  onTestReminder,
  onComplete,
}: {
  stream: MediaStream | null;
  devices: CameraDevice[];
  selectedCameraId: string | null;
  progress: number;
  calibrating: boolean;
  cameraAccessStatus: CameraAccessStatus;
  cameraFailureCode: CameraFailureCode | null;
  workerReady: boolean;
  canOpenCameraSettings: boolean;
  error: string | null;
  hasCalibration: boolean;
  onOpenCamera: () => void;
  onCloseCamera: () => void;
  onOpenCameraSettings: () => void;
  onSelectCamera: (id: string) => void;
  onCalibrate: () => void;
  onCancelCalibration: () => void;
  onTestReminder: () => Promise<void>;
  onComplete: () => void;
}): React.JSX.Element {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [reminderPreview, setReminderPreview] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const cameraRequestedRef = useRef(false);
  const calibrationStartedRef = useRef(false);

  useEffect(() => {
    if (step !== 1 || stream || cameraRequestedRef.current) return;
    cameraRequestedRef.current = true;
    onOpenCamera();
  }, [onOpenCamera, step, stream]);

  useEffect(() => {
    if (
      step !== 2 ||
      hasCalibration ||
      calibrating ||
      !stream ||
      !selectedCameraId ||
      !workerReady ||
      calibrationStartedRef.current
    )
      return;
    calibrationStartedRef.current = true;
    onCalibrate();
  }, [
    calibrating,
    hasCalibration,
    onCalibrate,
    selectedCameraId,
    step,
    stream,
    workerReady,
  ]);

  const cameraStatus = cameraFailureCode
    ? cameraFailureMessage[cameraFailureCode]
    : stream && workerReady
      ? "Camera and local posture model are ready."
      : stream
        ? "Camera ready. Loading the local posture model…"
        : cameraAccessStatus === "not-determined" ||
            cameraAccessStatus === "unknown"
          ? "Waiting for camera permission."
          : "Opening the selected camera…";

  const goBack = (): void => {
    if (step === 2) {
      if (calibrating) onCancelCalibration();
      calibrationStartedRef.current = false;
      setStep(1);
      return;
    }
    if (step === 1) {
      onCloseCamera();
      cameraRequestedRef.current = false;
      setStep(0);
    }
  };

  return (
    <main className="onboarding-shell">
      <section className="onboarding-panel" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <span className="wordmark">Upright</span>
          <span className="onboarding-count">0{step + 1} / 03</span>
        </header>

        <div className="onboarding-content">
          {step === 0 && (
            <>
              <div className="onboarding-copy">
                <span className="context-label">A gentler posture app</span>
                <h1 id="onboarding-title">
                  Notice the drift.
                  <br />
                  Not every movement.
                </h1>
                <p>
                  Upright learns how you naturally sit, uses that comfortable
                  position as your personal baseline, and waits for a sustained
                  change before offering a gentle reset.
                </p>
                <p className="onboarding-principle">
                  It does not react to every small movement or enforce “perfect
                  posture.”
                </p>
              </div>
              <ConceptVisual label="Comfortable baseline" />
            </>
          )}

          {step === 1 && (
            <>
              <div className="onboarding-copy camera-privacy-copy">
                <span className="context-label">Camera + privacy</span>
                <h1 id="onboarding-title">
                  Camera stays local.
                  <br />
                  Your posture stays yours.
                </h1>
                <p>
                  Upright analyzes posture on this Mac. No account, no cloud
                  upload, and no saved video.
                </p>
                <div className="privacy-card">
                  <LockKey size={19} weight="bold" aria-hidden="true" />
                  <div>
                    <strong>Processed on this Mac</strong>
                    <span>
                      Camera frames and raw landmarks are discarded in memory.
                    </span>
                  </div>
                </div>
                <label className="field onboarding-camera-select">
                  <span>Current camera</span>
                  <select
                    aria-describedby={
                      error ? "camera-status camera-error" : "camera-status"
                    }
                    value={selectedCameraId ?? ""}
                    onChange={(event) => onSelectCamera(event.target.value)}
                    disabled={!stream && devices.length === 0}
                  >
                    <option value="" disabled>
                      {devices.length === 0
                        ? "Looking for cameras"
                        : "Select a camera"}
                    </option>
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p id="camera-status" className="supporting-copy" role="status">
                  {cameraStatus}
                </p>
                {error && (
                  <p id="camera-error" className="inline-error" role="alert">
                    {error}
                  </p>
                )}
                {!stream && (
                  <div className="onboarding-recovery-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        cameraRequestedRef.current = true;
                        onOpenCamera();
                      }}
                    >
                      Try camera again
                    </button>
                    {(cameraAccessStatus === "denied" ||
                      cameraAccessStatus === "restricted") &&
                      canOpenCameraSettings && (
                        <button
                          className="text-button"
                          onClick={onOpenCameraSettings}
                        >
                          Open camera privacy settings
                        </button>
                      )}
                  </div>
                )}
              </div>
              <div className="onboarding-camera-visual">
                <CameraPreview stream={stream} compact />
                <span
                  className={`framing-status ${stream ? "ready" : "checking"}`}
                >
                  <i aria-hidden="true" />
                  {stream ? "Framing preview active" : "Waiting for camera"}
                </span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="onboarding-copy calibration-copy">
                <span className="context-label">Calibrate</span>
                <h1 id="onboarding-title">
                  {hasCalibration ? (
                    "Calibration complete"
                  ) : (
                    <>
                      Sit the way
                      <br />
                      you want to return to.
                    </>
                  )}
                </h1>
                <p>
                  {hasCalibration
                    ? "Your comfortable baseline is saved on this Mac. Upright is ready to notice sustained drift."
                    : "Sit the way you naturally want to return to. Upright learns that position for a few seconds."}
                </p>
                <div className="calibration-card">
                  <strong>
                    {hasCalibration
                      ? "Baseline saved"
                      : `${Math.max(0, Math.min(100, progress))}% calibrated`}
                  </strong>
                  <div
                    className="calibration-progress large"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={hasCalibration ? 100 : progress}
                    aria-label={`Calibration ${hasCalibration ? 100 : progress}% complete`}
                  >
                    <span
                      style={
                        {
                          "--progress-scale": hasCalibration
                            ? 1
                            : Math.max(0, Math.min(100, progress)) / 100,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <span>
                    {hasCalibration
                      ? "Your comfortable baseline is ready."
                      : "Keep sitting naturally."}
                  </span>
                </div>
                {error && (
                  <div className="calibration-retry">
                    <p className="inline-error" role="alert">
                      {error}
                    </p>
                    {!calibrating && (
                      <button
                        className="text-button"
                        onClick={() => {
                          calibrationStartedRef.current = true;
                          onCalibrate();
                        }}
                      >
                        Try calibration again
                      </button>
                    )}
                  </div>
                )}
              </div>
              <ConceptVisual
                label={
                  hasCalibration
                    ? "Baseline saved locally"
                    : "Learning your baseline…"
                }
                active={!hasCalibration}
                complete={hasCalibration}
              />
            </>
          )}
        </div>

        <footer className="onboarding-actions">
          <button
            className="button button-quiet"
            disabled={step === 0}
            onClick={goBack}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <div className="onboarding-primary-actions">
            {step === 0 && (
              <button
                className="button button-primary"
                onClick={() => setStep(1)}
              >
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {step === 1 && (
              <button
                className="button button-primary"
                disabled={!stream || !selectedCameraId || !workerReady}
                onClick={() => {
                  calibrationStartedRef.current = false;
                  setStep(2);
                }}
              >
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {step === 2 && !hasCalibration && (
              <button className="button button-disabled" disabled>
                Calibrating…
              </button>
            )}
            {step === 2 && hasCalibration && (
              <>
                <button
                  className="button button-quiet reminder-test"
                  disabled={reminderPreview === "pending"}
                  onClick={() => {
                    setReminderPreview("pending");
                    void onTestReminder()
                      .then(() => setReminderPreview("success"))
                      .catch(() => setReminderPreview("error"));
                  }}
                >
                  {reminderPreview === "pending"
                    ? "Opening…"
                    : reminderPreview === "success"
                      ? "Reminder opened"
                      : reminderPreview === "error"
                        ? "Try reminder again"
                        : "Test reminder"}
                </button>
                <button className="button button-primary" onClick={onComplete}>
                  <Check size={15} weight="bold" aria-hidden="true" />
                  Start tracking <ArrowRight size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </footer>

        <div className="onboarding-progress" aria-hidden="true">
          <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
      </section>
    </main>
  );
}

function ConceptVisual({
  label,
  active = false,
  complete = false,
}: {
  label: string;
  active?: boolean;
  complete?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`concept-visual ${active ? "active" : ""} ${complete ? "complete" : ""}`}
      aria-label={label}
    >
      <div className="concept-rings" aria-hidden="true">
        <i />
        <i />
        <i />
        <span className="concept-spine baseline" />
        <span className="concept-spine live" />
      </div>
      <strong>{label}</strong>
    </div>
  );
}
