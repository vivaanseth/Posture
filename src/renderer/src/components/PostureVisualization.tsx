export type PostureVisualizationState =
  | "good"
  | "caution"
  | "poor"
  | "recovering"
  | "back-in-range";

export interface PostureVisualizationOffset {
  /** Horizontal distance from the calibrated baseline, normalized to -1…1. */
  x: number;
  /** Vertical distance from the calibrated baseline, normalized to -1…1. */
  y: number;
}

export interface PostureVisualizationProps {
  state: PostureVisualizationState;
  /** Live displacement from the personal baseline. */
  offset?: PostureVisualizationOffset;
  /** Accessible description of the current posture state. */
  label: string;
  className?: string;
}

const clampOffset = (value: number): number =>
  Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));

const BASELINE_OFFSET: PostureVisualizationOffset = { x: 0, y: 0 };

export function PostureVisualization({
  state,
  offset = BASELINE_OFFSET,
  label,
  className,
}: PostureVisualizationProps): React.JSX.Element {
  const translateX = clampOffset(offset.x) * 32;
  const translateY = clampOffset(offset.y) * 24;
  const classes = [
    "posture-visualization",
    `posture-visualization--${state}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={classes} data-state={state}>
      <svg
        className="posture-visualization-canvas"
        viewBox="0 0 420 330"
        role="img"
        aria-label={label}
      >
        <g className="posture-reference-field" aria-hidden="true">
          <circle cx="210" cy="162" r="132" />
          <circle cx="210" cy="162" r="96" />
          <circle cx="210" cy="162" r="60" />
          <circle cx="210" cy="162" r="24" />
          <path d="M210 20V304" />
          <path d="M68 162H352" />
        </g>

        <g className="posture-baseline" aria-hidden="true">
          <circle cx="210" cy="64" r="15" />
          <path d="M210 79C199 111 202 142 210 169C219 198 219 232 210 270" />
          <path d="M210 119C191 111 174 113 160 126" />
          <path d="M210 119C229 112 246 114 260 126" />
        </g>

        <g
          className="posture-live-trace"
          aria-hidden="true"
          style={{ transform: `translate(${translateX}px, ${translateY}px)` }}
        >
          <circle className="posture-live-head" cx="210" cy="64" r="15" />
          <path
            className="posture-live-spine"
            d="M210 79C199 111 202 142 210 169C219 198 219 232 210 270"
          />
          <path
            className="posture-live-shoulder posture-live-shoulder--left"
            d="M210 119C191 111 174 113 160 126"
          />
          <path
            className="posture-live-shoulder posture-live-shoulder--right"
            d="M210 119C229 112 246 114 260 126"
          />
        </g>

        <g
          className="posture-alignment-marker"
          aria-hidden="true"
          style={{ transform: `translate(${translateX}px, ${translateY}px)` }}
        >
          <circle cx="210" cy="162" r="6" />
          <circle cx="210" cy="162" r="12" />
        </g>
      </svg>
    </figure>
  );
}
