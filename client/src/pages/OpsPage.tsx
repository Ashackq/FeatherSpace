import { runtimeConfig } from "../config/runtime";
import { getEnvironmentPipelineStatus } from "../config/environmentConfig";
import { useRealtimeStatus } from "../hooks/useRealtimeStatus";
import { useRoomSync } from "../hooks/useRoomSync";
import { useObjectSync } from "../hooks/useObjectSync";
import { operationsChecklist } from "../data/appData";

export function OpsPage() {
  const realtimeStatus = useRealtimeStatus(runtimeConfig.wsUrl, runtimeConfig.enableRealtime);
  const objectRoomSync = useRoomSync(
    runtimeConfig.wsUrl,
    runtimeConfig.enableRealtime,
    "research-studio",
  );
  const objectSync = useObjectSync({
    enabled: objectRoomSync.status.state === "connected",
    objectStates: objectRoomSync.objectStates,
    lastObjectStateUpdate: objectRoomSync.lastObjectStateUpdate,
    sendObjectEvent: objectRoomSync.sendObjectEvent,
  });
  const now = new Date();
  const generatedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  const schemaStatus = getEnvironmentPipelineStatus();

  const roomSync =
    realtimeStatus.state === "connected"
      ? "Nominal"
      : realtimeStatus.state === "disabled"
        ? "Local mode"
        : "Recovering";

  const signalingRelay = runtimeConfig.enableRealtime ? "Active" : "Standby";
  const mediaLayer = realtimeStatus.state === "connected" ? "Ready" : "Limited";
  const objectSyncLayer = objectRoomSync.status.state === "connected" ? "Live" : "Standby";
  const schemaPipeline = schemaStatus.isValid
    ? "Ready"
    : `${schemaStatus.totalErrors} validation issue${schemaStatus.totalErrors === 1 ? "" : "s"}`;

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
              <span>Object sync</span>
              <strong>{objectSyncLayer}</strong>
            </div>
            <div className="status-block">
              <span>Schema pipeline</span>
              <strong>{schemaPipeline}</strong>
            </div>
          </div>
          {!schemaStatus.isValid ? (
            <div className="schema-alert">
              <strong>Environment schema checks failing</strong>
              <ul>
                {schemaStatus.files
                  .flatMap((file) =>
                    file.errors.map((error) => ({
                      fileName: file.fileName,
                      ...error,
                    })),
                  )
                  .slice(0, 3)
                  .map((issue) => (
                    <li key={`${issue.fileName}-${issue.path}-${issue.message}`}>
                      {issue.fileName} {issue.path}: {issue.message}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <div className="object-metrics-grid">
            <div className="status-block">
              <span>Tracked object states</span>
              <strong>{objectSync.objectCount}</strong>
            </div>
            <div className="status-block">
              <span>Last object action</span>
              <strong>
                {objectSync.lastObjectStateUpdate
                  ? objectSync.lastObjectStateUpdate.action
                  : "none"}
              </strong>
            </div>
          </div>
          <p className="section-copy">Realtime signal: {realtimeStatus.message}</p>
        </article>
      </section>
    </div>
  );
}
