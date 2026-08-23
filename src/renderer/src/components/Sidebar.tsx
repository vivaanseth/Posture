import {
  Camera,
  ClockCounterClockwise,
  Gear,
  House,
  LockKey,
  PersonSimple,
} from "@phosphor-icons/react";
import type { View } from "../store";

const items: Array<{ view: View; label: string; icon: typeof House }> = [
  { view: "dashboard", label: "Today", icon: House },
  { view: "history", label: "History", icon: ClockCounterClockwise },
  { view: "diagnostics", label: "Camera", icon: Camera },
  { view: "settings", label: "Settings", icon: Gear },
];

const headingIds: Record<View, string> = {
  dashboard: "dashboard-title",
  history: "history-title",
  diagnostics: "camera-title",
  settings: "settings-title",
};

export function Sidebar({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}): React.JSX.Element {
  return (
    <aside className="sidebar" aria-label="Upright">
      <div className="brand" aria-label="Upright">
        <span className="brand-mark" aria-hidden="true">
          <PersonSimple size={21} weight="bold" />
        </span>
        <span className="visually-hidden">Upright</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.view;
          return (
            <button
              type="button"
              key={item.view}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => {
                onChange(item.view);
                window.requestAnimationFrame(() => {
                  const heading = document.getElementById(
                    headingIds[item.view],
                  );
                  if (!heading) return;
                  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
                  heading.focus();
                });
              }}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              data-tooltip={item.label}
            >
              <Icon
                className="nav-item-icon"
                size={20}
                weight={isActive ? "fill" : "regular"}
                aria-hidden="true"
              />
              <span className="nav-tooltip" role="tooltip">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      <div
        className="privacy-note"
        tabIndex={0}
        aria-label="Local by design. Camera processing stays on this computer."
        data-tooltip="Local by design"
      >
        <LockKey size={18} weight="fill" aria-hidden="true" />
        <span className="privacy-tooltip" role="tooltip">
          <strong>Local by design</strong>
          <span>Camera processing stays on this computer.</span>
        </span>
      </div>
    </aside>
  );
}
