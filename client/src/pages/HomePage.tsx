import { Link } from "react-router-dom";
import { ScenePreview } from "../components/ScenePreview";
import { overviewHighlights, statCards, systemTracks } from "../data/appData";

export function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-grid panel-surface hero-surface">
        <div className="hero-copy">
          <span className="eyebrow">Frontend Overview</span>
          <h2>Collaborate across rooms with a stable, real-time workspace.</h2>
          <p>
            FeatherSpace provides a consistent flow across room directory, live runtime, operations,
            and configuration so teams can move from setup to collaboration without friction.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/rooms?demo=1">
              Open workspace
            </Link>
            <Link className="button button-secondary" to="/builder">
              Open environment builder
            </Link>
          </div>
        </div>

        <div className="hero-metrics">
          {statCards.map((card) => (
            <article key={card.label} className="metric-card">
              <span className="metric-label">{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-surface two-column-grid">
        <div>
          <span className="eyebrow">Spatial Preview</span>
          <h3>Live viewport preview for room interactions</h3>
          <p className="section-copy">
            This preview mirrors the runtime stage used in room pages, so camera movement and object
            placement stay consistent across collaboration sessions.
          </p>
          <ScenePreview />
        </div>

        <div className="stack-list">
          {overviewHighlights.map((item) => (
            <article key={item.title} className="feature-card">
              <span className="eyebrow">{item.eyebrow}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-surface">
        <div className="section-header">
          <div>
            <span className="eyebrow">System Tracks</span>
            <h3>Clear implementation tracks for frontend, runtime, and environment teams</h3>
          </div>
        </div>
        <div className="card-grid three-up">
          {systemTracks.map((track) => (
            <article key={track.title} className="feature-card">
              <h3>{track.title}</h3>
              <ul className="feature-list">
                {track.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
