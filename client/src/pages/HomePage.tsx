import { Link } from "react-router-dom";
import { ScenePreview } from "../components/ScenePreview";
import { overviewHighlights, statCards, systemTracks } from "../data/appData";

export function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-grid panel-surface hero-surface">
        <div className="hero-copy">
          <span className="eyebrow">Frontend Overview</span>
          <h2>Build a room platform that looks organized before the networking layer is finished.</h2>
          <p>
            This scaffold gives your capstone a credible product shell: navigation, landing narrative,
            room previews, operations surfaces, and builder-oriented screens.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/rooms">
              Explore room surfaces
            </Link>
            <Link className="button button-secondary" to="/builder">
              Review builder workflow
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
          <h3>Viewport placeholder for the live room experience</h3>
          <p className="section-copy">
            Use this card as the eventual bridge between Phaser rendering and UI overlays. For now it
            acts as a polished proof surface during demos.
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
            <h3>Structure the frontend so every teammate sees where their work lands</h3>
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
