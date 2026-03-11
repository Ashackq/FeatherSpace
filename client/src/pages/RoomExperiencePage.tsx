import { Link, useParams } from "react-router-dom";
import { ScenePreview } from "../components/ScenePreview";
import { roomExperience } from "../data/appData";

export function RoomExperiencePage() {
  const { roomId } = useParams();

  return (
    <div className="page-stack room-page">
      <section className="panel-surface room-hero-panel">
        <div className="room-hero-copy">
          <div className="hero-actions-inline">
            {roomExperience.sceneBadges.map((badge) => (
              <span key={badge} className="status-pill">
                {badge}
              </span>
            ))}
          </div>
          <h2>{roomExperience.roomName}</h2>
          <p>
            {roomExperience.hostLabel} · Route: <strong>/{roomId}</strong>
          </p>
        </div>
        <div className="room-hero-actions">
          <Link className="button button-secondary" to="/rooms">
            Exit to directory
          </Link>
          <button className="button button-primary" type="button">
            Invite participant
          </button>
        </div>
      </section>

      <section className="room-layout">
        <div className="room-stage panel-surface">
          <div className="room-stage-topbar">
            {roomExperience.overlays.map((overlay) => (
              <article key={overlay.title} className="overlay-chip">
                <span className="eyebrow">{overlay.title}</span>
                <strong>{overlay.value}</strong>
                <p>{overlay.detail}</p>
              </article>
            ))}
          </div>

          <ScenePreview />

          <div className="media-control-dock">
            {roomExperience.mediaControls.map((control) => (
              <button key={control.label} className="media-control" type="button">
                <span>{control.label}</span>
                <strong>{control.state}</strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="room-side-rail">
          <section className="panel-surface participant-rail">
            <div className="section-header">
              <div>
                <span className="eyebrow">Participants</span>
                <h3>Live room rail</h3>
              </div>
            </div>

            <div className="participant-list">
              {roomExperience.participants.map((participant) => (
                <article key={participant.name} className="participant-card">
                  <div className={`participant-avatar participant-avatar-${participant.accent}`}>
                    {participant.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{participant.name}</strong>
                    <p>{participant.role}</p>
                  </div>
                  <span className="participant-status">{participant.status}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel-surface live-panels-stack">
            {roomExperience.livePanels.map((panel) => (
              <article key={panel.title} className="live-panel-card">
                <h3>{panel.title}</h3>
                <div className="live-panel-rows">
                  {panel.rows.map((row) => (
                    <div key={`${panel.title}-${row.label}`} className="live-panel-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </aside>
      </section>
    </div>
  );
}