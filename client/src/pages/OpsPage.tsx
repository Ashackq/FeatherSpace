import { runtimeConfig } from "../config/runtime";
import { useRealtimeStatus } from "../hooks/useRealtimeStatus";
import { operationsChecklist } from "../data/appData";

export function OpsPage() {
  const realtimeStatus = useRealtimeStatus(runtimeConfig.wsUrl, runtimeConfig.enableRealtime);
  const now = new Date();
  const generatedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

  const roomSync =
    realtimeStatus.state === "connected"
      ? "Nominal"
      : realtimeStatus.state === "disabled"
        ? "Local mode"
        : "Recovering";

  const signalingRelay = runtimeConfig.enableRealtime ? "Active" : "Standby";
  const mediaLayer = realtimeStatus.state === "connected" ? "Ready" : "Limited";
  const schemaPipeline = "Ready";

  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Operations</span>
        <h2>Monitor room readiness, sync reliability, and deployment mode from one surface.</h2>
        <p>
          Operational visibility updates from runtime configuration and connection state so teams can
          quickly assess system posture.
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
          <h3>Live status board</h3>
          <p className="section-copy">Snapshot generated at {generatedAt}</p>
          <div className="status-grid">
            <div className="status-block">
              <span>Room sync</span>
              <strong>{roomSync}</strong>
            </div>
            <div className="status-block">
              <span>Signaling relay</span>
              <strong>{signalingRelay}</strong>
            </div>
            <div className="status-block">
              <span>Media layer</span>
              <strong>{mediaLayer}</strong>
            </div>
            <div className="status-block">
              <span>Schema pipeline</span>
              <strong>{schemaPipeline}</strong>
            </div>
          </div>
          <p className="section-copy">Realtime signal: {realtimeStatus.message}</p>
        </article>
      </section>
    </div>
  );
}
