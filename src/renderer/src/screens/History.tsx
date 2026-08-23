import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useState, type CSSProperties } from "react";
import type { SessionSummary } from "../../../shared/contracts";

const DAY_MS = 24 * 60 * 60 * 1_000;
const WEEK_MS = 7 * DAY_MS;
const dayLabels = ["M", "T", "W", "T", "F", "S", "S"] as const;

interface PeriodSummary {
  categorizedMs: number;
  goodMs: number;
  trackedMs: number;
  reminderCount: number;
}

interface DaySummary extends PeriodSummary {
  date: Date;
  sessionCount: number;
  comfortablePercent: number | null;
}

const startOfLocalDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const startOfLocalWeek = (date: Date): Date => {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};

const addLocalDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const validSessionDate = (session: SessionSummary): Date | null => {
  const date = new Date(session.startedAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const categorizedDuration = (session: SessionSummary): number =>
  session.goodMs + session.cautionMs + session.poorMs;

const comfortablePercent = (
  goodMs: number,
  categorizedMs: number,
): number | null =>
  categorizedMs > 0 ? Math.round((goodMs / categorizedMs) * 100) : null;

const duration = (milliseconds: number): string => {
  const minutes = Math.round(milliseconds / 60_000);
  if (milliseconds > 0 && minutes === 0) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const summarizeSessions = (sessions: SessionSummary[]): PeriodSummary =>
  sessions.reduce<PeriodSummary>(
    (summary, session) => ({
      categorizedMs: summary.categorizedMs + categorizedDuration(session),
      goodMs: summary.goodMs + session.goodMs,
      trackedMs: summary.trackedMs + session.trackedMs,
      reminderCount: summary.reminderCount + session.reminderCount,
    }),
    { categorizedMs: 0, goodMs: 0, trackedMs: 0, reminderCount: 0 },
  );

const sessionsInWeek = (
  sessions: SessionSummary[],
  weekStart: Date,
): SessionSummary[] => {
  const nextWeek = addLocalDays(weekStart, 7);
  return sessions.filter((session) => {
    const date = validSessionDate(session);
    return date !== null && date >= weekStart && date < nextWeek;
  });
};

const weekRangeLabel = (weekStart: Date, isCurrentWeek: boolean): string => {
  if (isCurrentWeek) return "This week";
  const weekEnd = addLocalDays(weekStart, 6);
  const start = weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const end = weekEnd.toLocaleDateString(undefined, {
    month: weekStart.getMonth() === weekEnd.getMonth() ? undefined : "short",
    day: "numeric",
    year:
      weekStart.getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
  return `${start} – ${end}`;
};

const sessionDateLabel = (date: Date, today: Date): string => {
  const day = startOfLocalDay(date).getTime();
  if (day === today.getTime()) return "Today";
  if (day === addLocalDays(today, -1).getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

export function History({
  sessions,
}: {
  sessions: SessionSummary[];
}): React.JSX.Element {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = startOfLocalDay(new Date());
  const currentWeekStart = startOfLocalWeek(today);

  const validSessions = sessions
    .filter((session) => validSessionDate(session) !== null)
    .toSorted(
      (a, b) =>
        (validSessionDate(b)?.getTime() ?? 0) -
        (validSessionDate(a)?.getTime() ?? 0),
    );

  const earliestDate =
    validSessions.length > 0 ? validSessionDate(validSessions.at(-1)!) : null;
  const earliestWeekOffset = earliestDate
    ? Math.min(
        0,
        Math.round(
          (startOfLocalWeek(earliestDate).getTime() -
            currentWeekStart.getTime()) /
            WEEK_MS,
        ),
      )
    : 0;

  const boundedWeekOffset = Math.min(
    0,
    Math.max(weekOffset, earliestWeekOffset),
  );
  const selectedWeekStart = addLocalDays(
    currentWeekStart,
    boundedWeekOffset * 7,
  );
  const selectedSessions = sessionsInWeek(validSessions, selectedWeekStart);
  const selectedSummary = summarizeSessions(selectedSessions);
  const selectedComfortable = comfortablePercent(
    selectedSummary.goodMs,
    selectedSummary.categorizedMs,
  );
  const previousWeekSummary = summarizeSessions(
    sessionsInWeek(validSessions, addLocalDays(selectedWeekStart, -7)),
  );
  const previousWeekComfortable = comfortablePercent(
    previousWeekSummary.goodMs,
    previousWeekSummary.categorizedMs,
  );
  const trendPoints =
    selectedComfortable === null || previousWeekComfortable === null
      ? null
      : selectedComfortable - previousWeekComfortable;

  const days: DaySummary[] = dayLabels.map((_, index) => {
    const date = addLocalDays(selectedWeekStart, index);
    const daySessions = selectedSessions.filter((session) => {
      const sessionDate = validSessionDate(session);
      return (
        sessionDate !== null &&
        startOfLocalDay(sessionDate).getTime() === date.getTime()
      );
    });
    const summary = summarizeSessions(daySessions);
    return {
      ...summary,
      date,
      sessionCount: daySessions.length,
      comfortablePercent: comfortablePercent(
        summary.goodMs,
        summary.categorizedMs,
      ),
    };
  });

  const bestDay = days.reduce<DaySummary | null>((best, day) => {
    if (day.comfortablePercent === null) return best;
    return best === null ||
      best.comfortablePercent === null ||
      day.comfortablePercent > best.comfortablePercent
      ? day
      : best;
  }, null);
  const mondayPercent = days[0]?.comfortablePercent ?? null;
  const canGoPrevious = boundedWeekOffset > earliestWeekOffset;
  const canGoNext = boundedWeekOffset < 0;

  return (
    <section className="screen history-screen" aria-labelledby="history-title">
      <span className="history-brand" aria-hidden="true">
        Upright
      </span>

      <div className="history-layout">
        <header className="history-hero">
          <span className="context-label">History</span>
          <h1 id="history-title" tabIndex={-1}>
            Your posture,
            <br />
            over time.
          </h1>
          <p>Look for patterns, not perfect days.</p>

          <div className="history-period-summary" aria-live="polite">
            <strong className="history-comfortable-value">
              {selectedComfortable === null ? "—" : `${selectedComfortable}%`}
            </strong>
            <span>
              comfortable{" "}
              {boundedWeekOffset === 0 ? "this week" : "this period"}
            </span>
          </div>

          <dl className="history-secondary-metrics">
            <div>
              <dd>{duration(selectedSummary.trackedMs)}</dd>
              <dt>tracked</dt>
            </div>
            <div>
              <dd>{selectedSummary.reminderCount}</dd>
              <dt>
                gentle{" "}
                {selectedSummary.reminderCount === 1 ? "nudge" : "nudges"}
              </dt>
            </div>
          </dl>

          <div className="history-period-insights" aria-live="polite">
            {bestDay ? (
              <p>
                Best day:{" "}
                {bestDay.date.toLocaleDateString(undefined, {
                  weekday: "short",
                })}{" "}
                · {bestDay.comfortablePercent}% comfortable
                {mondayPercent !== null &&
                  bestDay.date.getTime() !== days[0]?.date.getTime() && (
                    <>
                      {" "}
                      ·{" "}
                      {bestDay.comfortablePercent! - mondayPercent >= 0
                        ? "+"
                        : ""}
                      {bestDay.comfortablePercent! - mondayPercent} pts vs Mon
                    </>
                  )}
              </p>
            ) : (
              <p>No comfortable-time pattern for this week yet.</p>
            )}
            {trendPoints !== null && (
              <p className="history-trend">
                {trendPoints > 0 ? "↑" : trendPoints < 0 ? "↓" : "→"}{" "}
                {trendPoints === 0
                  ? "No change from last week"
                  : `${Math.abs(trendPoints)} ${
                      Math.abs(trendPoints) === 1 ? "pt" : "pts"
                    } ${trendPoints > 0 ? "from" : "below"} last week`}
              </p>
            )}
          </div>
        </header>

        <div className="history-data-column">
          <section
            className="weekly-rhythm"
            aria-labelledby="weekly-rhythm-title"
          >
            <div className="weekly-rhythm-header">
              <div>
                <h2 id="weekly-rhythm-title">Weekly rhythm</h2>
                <p>Comfortable time</p>
              </div>
              <div className="week-range-control" aria-label="Choose week">
                <button
                  type="button"
                  aria-label="Previous week"
                  disabled={!canGoPrevious}
                  onClick={() => setWeekOffset(boundedWeekOffset - 1)}
                >
                  <CaretLeft size={14} weight="bold" aria-hidden="true" />
                </button>
                <span>
                  {weekRangeLabel(selectedWeekStart, boundedWeekOffset === 0)}
                </span>
                <button
                  type="button"
                  aria-label="Next week"
                  disabled={!canGoNext}
                  onClick={() => setWeekOffset(boundedWeekOffset + 1)}
                >
                  <CaretRight size={14} weight="bold" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              className={`weekly-rhythm-chart${
                selectedSummary.categorizedMs === 0 ? " is-empty" : ""
              }`}
              style={
                {
                  "--history-week-average": `${selectedComfortable ?? 0}%`,
                } as CSSProperties
              }
            >
              <span className="weekly-average-rule" aria-hidden="true" />
              {days.map((day, index) => {
                const percent = day.comfortablePercent;
                const fullDate = day.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                });
                return (
                  <div
                    className={`weekly-day${
                      percent === null ? " has-no-data" : ""
                    }`}
                    key={day.date.toISOString()}
                    aria-label={
                      percent === null
                        ? `${fullDate}: no tracked posture data`
                        : `${fullDate}: ${percent}% comfortable across ${
                            day.sessionCount
                          } ${day.sessionCount === 1 ? "session" : "sessions"}`
                    }
                  >
                    <span className="weekly-day-value-label">
                      {percent === null ? "—" : `${percent}%`}
                    </span>
                    <span className="weekly-day-track" aria-hidden="true">
                      <span
                        className="weekly-day-value"
                        style={
                          {
                            "--history-day-value": `${percent ?? 0}%`,
                          } as CSSProperties
                        }
                      />
                    </span>
                    <span
                      className="weekly-day-label"
                      aria-current={
                        day.date.getTime() === today.getTime()
                          ? "date"
                          : undefined
                      }
                    >
                      {dayLabels[index]}
                    </span>
                  </div>
                );
              })}
              {selectedSummary.categorizedMs === 0 && (
                <p className="weekly-rhythm-empty">
                  No tracked posture data for this week.
                </p>
              )}
            </div>
          </section>

          <section
            className="recent-sessions"
            aria-labelledby="recent-sessions-title"
          >
            <h2 id="recent-sessions-title">Recent sessions</h2>
            {validSessions.length === 0 ? (
              <div className="history-empty">
                <strong>No completed sessions yet.</strong>
                <p>
                  Completed tracking sessions will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="history-list" role="list">
                {validSessions.slice(0, 3).map((session) => {
                  const date = validSessionDate(session)!;
                  const percent = comfortablePercent(
                    session.goodMs,
                    categorizedDuration(session),
                  );
                  return (
                    <article
                      className="history-row"
                      key={session.id}
                      role="listitem"
                    >
                      <time dateTime={session.startedAt}>
                        {sessionDateLabel(date, today)}
                      </time>
                      <span className="history-session-duration">
                        {duration(session.trackedMs)}
                      </span>
                      <span className="history-session-comfortable">
                        {percent === null
                          ? "No classified time"
                          : `${percent}% comfortable`}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
