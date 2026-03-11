export function BuilderPage() {
  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Environment Builder</span>
        <h2>Reserve a full UI surface for JSON-driven environment management.</h2>
        <p>
          This page frames where schema-backed configuration, object presets, and room publication
          tools will live.
        </p>
      </section>

      <section className="card-grid two-up">
        <article className="feature-card">
          <span className="eyebrow">Authoring Flow</span>
          <h3>Compose maps, communication rules, and interactive objects.</h3>
          <p>
            Add editors for map dimensions, talk radius, peer caps, and object placement without
            changing runtime code.
          </p>
        </article>

        <article className="feature-card accent-card">
          <span className="eyebrow">Validation Gate</span>
          <h3>AJV-backed checks should become a visible publish step.</h3>
          <p>
            Keep invalid environments from reaching runtime and make schema errors understandable to
            teammates.
          </p>
        </article>
      </section>

      <section className="panel-surface workflow-panel">
        <div className="workflow-step">
          <strong>1</strong>
          <div>
            <h3>Draft environment</h3>
            <p>Lay out map size, objects, and communication parameters.</p>
          </div>
        </div>
        <div className="workflow-step">
          <strong>2</strong>
          <div>
            <h3>Validate schema</h3>
            <p>Surface version issues, missing fields, and unsafe values before publish.</p>
          </div>
        </div>
        <div className="workflow-step">
          <strong>3</strong>
          <div>
            <h3>Publish room template</h3>
            <p>Promote a valid configuration into the room library for frontend and backend use.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
