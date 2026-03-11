import { operationsChecklist } from "../data/appData";

export function OpsPage() {
  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Operations</span>
        <h2>Give the project a real operator surface, even before telemetry is live.</h2>
        <p>
          This page is where environment health, sync status, session errors, and room activity can
          converge once the backend and RTC tracks mature.
        </p>
      </section>

      <section className="card-grid two-up">
        <article className="feature-card">
          <h3>Operational checklist</h3>
          <ul className="feature-list">
            {operationsChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="feature-card">
          <h3>Status placeholders</h3>
          <div className="status-grid">
            <div className="status-block">
              <span>Room sync</span>
              <strong>Nominal</strong>
            </div>
            <div className="status-block">
              <span>Signaling relay</span>
              <strong>Standby</strong>
            </div>
            <div className="status-block">
              <span>Media layer</span>
              <strong>Pending</strong>
            </div>
            <div className="status-block">
              <span>Schema pipeline</span>
              <strong>Ready</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
