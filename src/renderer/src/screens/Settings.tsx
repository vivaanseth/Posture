import { ArrowRight, ArrowSquareOut } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type {
  CalibrationRecord,
  Settings as SettingsType,
} from "../../../shared/contracts";

type Operation =
  | "setting"
  | "export"
  | "delete-sessions"
  | "delete-calibration"
  | "reset"
  | "external";

interface SettingsProps {
  settings: SettingsType;
  version: string;
  calibrations: CalibrationRecord[];
  onUpdate: (patch: Partial<SettingsType>) => Promise<void>;
  onOpenDiagnostics: () => void;
  onExport: () => Promise<string | null>;
  onDeleteSessions: () => Promise<void>;
  onDeleteCalibration: (cameraId: string) => Promise<void>;
  onResetAll: () => Promise<void>;
}

export function Settings({
  settings,
  version,
  calibrations,
  onUpdate,
  onOpenDiagnostics,
  onExport,
  onDeleteSessions,
  onDeleteCalibration,
  onResetAll,
}: SettingsProps): React.JSX.Element {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { type: "delete-sessions" }
    | { type: "delete-calibration"; cameraId: string }
    | { type: "reset" }
    | null
  >(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const busy = operation !== null;

  const run = async (
    name: Operation,
    action: () => Promise<void>,
    success: string,
  ): Promise<void> => {
    setOperation(name);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: "success", text: success });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "That change could not be completed. Please try again.",
      });
    } finally {
      setOperation(null);
    }
  };

  const update = (settingsPatch: Partial<SettingsType>): void => {
    void run("setting", () => onUpdate(settingsPatch), "Setting saved.");
  };

  const exportData = (): void => {
    void run(
      "export",
      async () => {
        await onExport();
      },
      "Local data exported.",
    );
  };

  const confirmDestructiveAction = (): void => {
    const pending = confirmation;
    setConfirmation(null);
    if (!pending) return;
    if (pending.type === "delete-sessions") {
      void run("delete-sessions", onDeleteSessions, "Session history deleted.");
      return;
    }
    if (pending.type === "delete-calibration") {
      void run(
        "delete-calibration",
        () => onDeleteCalibration(pending.cameraId),
        "Camera calibration deleted.",
      );
      return;
    }
    void run("reset", onResetAll, "Upright was reset.");
  };

  const newestCalibration = calibrations.at(0);

  return (
    <section
      className="screen settings-screen"
      aria-labelledby="settings-title"
    >
      <aside className="settings-intro">
        <span className="context-label">Preferences</span>
        <h1 id="settings-title" tabIndex={-1}>
          Make Upright
          <br />
          fit your day.
        </h1>
        <p>Only the controls you’ll actually use.</p>

        <div className="privacy-summary">
          <strong>Local by design</strong>
          <span>Camera processing and session data stay on this Mac.</span>
          <i aria-hidden="true" />
        </div>

        <div className="calibration-summary">
          <strong>Calibration</strong>
          <span>
            {newestCalibration
              ? new Date(newestCalibration.createdAt).toLocaleDateString()
              : "No saved baseline"}
          </span>
          <button className="text-button" onClick={onOpenDiagnostics}>
            Recalibrate <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>

        <p className="settings-side-note">
          Advanced diagnostics are hidden by default.
        </p>
        <div
          className={`settings-feedback ${feedback?.kind ?? ""}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {operation ? "Saving…" : (feedback?.text ?? "")}
        </div>
      </aside>

      <div className="settings-panel" aria-busy={busy}>
        <SettingsSection title="Feedback">
          <SelectRow
            label="Sensitivity"
            value={settings.sensitivity}
            disabled={busy}
            onChange={(value) =>
              update({ sensitivity: value as SettingsType["sensitivity"] })
            }
            options={[
              ["low", "Low"],
              ["balanced", "Balanced"],
              ["high", "High"],
            ]}
          />
          <SelectRow
            label="Poor posture delay"
            value={String(settings.reminderDelaySeconds)}
            disabled={busy}
            onChange={(value) =>
              update({
                reminderDelaySeconds: Number(value) as 15 | 30 | 60,
              })
            }
            options={[
              ["15", "15 seconds"],
              ["30", "30 seconds"],
              ["60", "60 seconds"],
            ]}
          />
          <ToggleRow
            label="Reminder sound"
            checked={settings.soundEnabled}
            disabled={busy}
            onChange={(checked) => update({ soundEnabled: checked })}
          />
        </SettingsSection>

        <SettingsSection title="Camera">
          <ToggleRow
            label="Advanced diagnostics"
            checked={settings.diagnosticsEnabled}
            disabled={busy}
            onChange={(checked) => update({ diagnosticsEnabled: checked })}
          />
          <ActionRow
            label="Camera and calibration"
            action="Open"
            disabled={busy}
            onClick={onOpenDiagnostics}
          />
          {calibrations.length > 0 && (
            <details className="settings-details calibration-details">
              <summary>Saved camera baselines ({calibrations.length})</summary>
              {calibrations.map((calibration) => (
                <div className="saved-calibration-row" key={calibration.id}>
                  <span>
                    {new Date(calibration.createdAt).toLocaleDateString()}
                    {calibration.cameraId === settings.selectedCameraId
                      ? " · Current camera"
                      : ""}
                  </span>
                  <button
                    className="text-button destructive-text"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({
                        type: "delete-calibration",
                        cameraId: calibration.cameraId,
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              ))}
            </details>
          )}
        </SettingsSection>

        <SettingsSection title="Data">
          <ActionRow
            label="Export local data"
            action="Export"
            disabled={busy}
            onClick={exportData}
          />
          <ActionRow
            label="Delete session history"
            action="Delete"
            destructive
            disabled={busy}
            onClick={() => setConfirmation({ type: "delete-sessions" })}
          />
          <ActionRow
            label="Reset all local data"
            action="Reset…"
            quiet
            destructive
            disabled={busy}
            onClick={() => setConfirmation({ type: "reset" })}
          />
        </SettingsSection>

        <details className="settings-details app-behavior">
          <summary>App behavior and appearance</summary>
          <SelectRow
            label="Reminder cooldown"
            value={String(settings.cooldownMinutes)}
            disabled={busy}
            onChange={(value) =>
              update({ cooldownMinutes: Number(value) as 5 | 10 | 20 })
            }
            options={[
              ["5", "5 minutes"],
              ["10", "10 minutes"],
              ["20", "20 minutes"],
            ]}
          />
          <ToggleRow
            label="Launch at login"
            checked={settings.launchAtLogin}
            disabled={busy}
            onChange={(checked) => update({ launchAtLogin: checked })}
          />
          <ToggleRow
            label="Start tracking automatically"
            checked={settings.autoStartTracking}
            disabled={busy}
            onChange={(checked) => update({ autoStartTracking: checked })}
          />
          <ToggleRow
            label="Reduce work on battery"
            checked={settings.reduceOnBattery}
            disabled={busy}
            onChange={(checked) => update({ reduceOnBattery: checked })}
          />
          <SelectRow
            label="Appearance"
            value={settings.theme}
            disabled={busy}
            onChange={(value) =>
              update({ theme: value as SettingsType["theme"] })
            }
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
          />
        </details>

        <footer className="settings-footer">
          <span>Upright {version} · Not medical software</span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(
                "external",
                () => window.upright.app.openExternalTrustedUrl("privacy"),
                "Opened privacy information.",
              )
            }
          >
            Privacy <ArrowSquareOut size={13} aria-hidden="true" />
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(
                "external",
                () => window.upright.app.openExternalTrustedUrl("repository"),
                "Opened source information.",
              )
            }
          >
            Source <ArrowSquareOut size={13} aria-hidden="true" />
          </button>
        </footer>
      </div>

      {confirmation && (
        <ConfirmationDialog
          kind={confirmation.type}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmDestructiveAction}
        />
      )}
    </section>
  );
}

function SettingsSection({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>): React.JSX.Element {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function SelectRow({
  label,
  value,
  disabled,
  onChange,
  options,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  options: [string, string][];
}): React.JSX.Element {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  const descriptionId = useId();
  return (
    <div className="setting-row">
      <span id={descriptionId}>{label}</span>
      <button
        className={`switch ${checked ? "checked" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-labelledby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function ActionRow({
  label,
  action,
  destructive = false,
  quiet = false,
  disabled,
  onClick,
}: {
  label: string;
  action: string;
  destructive?: boolean;
  quiet?: boolean;
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <div className={`setting-row action-row ${quiet ? "quiet" : ""}`}>
      <span>{label}</span>
      <button
        className={`text-button ${destructive ? "destructive-text" : ""}`}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  );
}

function ConfirmationDialog({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: "delete-sessions" | "delete-calibration" | "reset";
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const isReset = kind === "reset";

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const title = isReset
    ? "Reset all local data?"
    : kind === "delete-sessions"
      ? "Delete session history?"
      : "Delete this calibration?";
  const description = isReset
    ? "This removes session history, calibration, and preferences from this Mac. This cannot be undone."
    : kind === "delete-sessions"
      ? "This removes every saved session summary. Calibration and preferences remain."
      : "You will need to recalibrate before tracking with this camera again.";

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div>
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-description">{description}</p>
        {isReset && (
          <label className="field">
            <span>Type RESET to confirm</span>
            <input
              autoComplete="off"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder="Type RESET to confirm"
            />
          </label>
        )}
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            className="button button-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="button button-danger"
            disabled={isReset && confirmationText !== "RESET"}
            onClick={onConfirm}
          >
            {isReset ? "Reset data" : "Delete"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
