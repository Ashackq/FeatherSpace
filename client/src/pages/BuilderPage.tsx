import { useMemo, useState } from "react";
import { validateEnvironmentCandidate } from "../config/environmentConfig";
import type { EnvironmentConfig } from "../types";

type BuilderDraft = {
  templateName: string;
  mapWidth: number;
  mapHeight: number;
  talkRadius: number;
  maxPeers: number;
  objectCount: number;
};

const initialDraft: BuilderDraft = {
  templateName: "Research Studio",
  mapWidth: 2000,
  mapHeight: 1200,
  talkRadius: 180,
  maxPeers: 4,
  objectCount: 6,
};

export function BuilderPage() {
  const [draft, setDraft] = useState<BuilderDraft>(initialDraft);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (draft.templateName.trim().length < 3) {
      messages.push("Template name must be at least 3 characters.");
    }
    if (draft.mapWidth < 400 || draft.mapHeight < 300) {
      messages.push("Map dimensions must be at least 400 x 300.");
    }
    if (draft.talkRadius < 80 || draft.talkRadius > 320) {
      messages.push("Talk radius must be between 80 and 320.");
    }
    if (draft.maxPeers < 1 || draft.maxPeers > 8) {
      messages.push("Max peers must be between 1 and 8.");
    }
    if (draft.objectCount < 0 || draft.objectCount > 100) {
      messages.push("Object count must be between 0 and 100.");
    }

    return messages;
  }, [draft]);

  const generatedConfig = useMemo<EnvironmentConfig>(
    () => ({
      version: "1.0.0",
      map: {
        width: draft.mapWidth,
        height: draft.mapHeight,
      },
      communication: {
        talkRadius: draft.talkRadius,
        maxPeers: draft.maxPeers,
      },
      objects: Array.from({ length: draft.objectCount }, (_, index) => ({
        id: `object_${index + 1}`,
        type: index % 2 === 0 ? "whiteboard" : "private_room",
        x: 220 + (index % 5) * 220,
        y: 180 + Math.floor(index / 5) * 170,
      })),
    }),
    [draft],
  );

  const schemaValidation = useMemo(
    () => validateEnvironmentCandidate(generatedConfig),
    [generatedConfig],
  );

  const isValid = validationMessages.length === 0 && schemaValidation.isValid;

  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Environment Builder</span>
        <h2>Build room templates with immediate configuration feedback.</h2>
        <p>
          This editor generates room configuration snapshots from form inputs so teams can iterate
          quickly with clear, validated configuration output.
        </p>
      </section>

      <section className="card-grid two-up">
        <article className="feature-card">
          <span className="eyebrow">Template Editor</span>
          <h3>Environment configuration inputs</h3>
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="field-group">
              <label className="field-label" htmlFor="templateName">
                Template name
              </label>
              <input
                id="templateName"
                className="input-field"
                value={draft.templateName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    templateName: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="mapWidth">
                  Map width
                </label>
                <input
                  id="mapWidth"
                  className="input-field"
                  type="number"
                  min={400}
                  max={5000}
                  value={draft.mapWidth}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      mapWidth: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="mapHeight">
                  Map height
                </label>
                <input
                  id="mapHeight"
                  className="input-field"
                  type="number"
                  min={300}
                  max={5000}
                  value={draft.mapHeight}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      mapHeight: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="talkRadius">
                  Talk radius
                </label>
                <input
                  id="talkRadius"
                  className="input-field"
                  type="number"
                  min={80}
                  max={320}
                  value={draft.talkRadius}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      talkRadius: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="maxPeers">
                  Max peers
                </label>
                <input
                  id="maxPeers"
                  className="input-field"
                  type="number"
                  min={1}
                  max={8}
                  value={draft.maxPeers}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maxPeers: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="objectCount">
                Object count
              </label>
              <input
                id="objectCount"
                className="input-field"
                type="number"
                min={0}
                max={100}
                value={draft.objectCount}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    objectCount: Number(event.target.value),
                  }))
                }
              />
            </div>
          </form>
        </article>

        <article className="feature-card accent-card">
          <span className="eyebrow">Validation Gate</span>
          <h3>{isValid ? "Configuration passes all guardrails" : "Configuration needs attention"}</h3>
          {isValid ? (
            <p>Draft is valid and ready to publish to the room directory.</p>
          ) : (
            <>
              {validationMessages.length > 0 ? (
                <>
                  <p className="section-copy">Form validation</p>
                  <ul className="feature-list">
                    {validationMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {!schemaValidation.isValid ? (
                <>
                  <p className="section-copy">Schema validation (AJV)</p>
                  <ul className="feature-list">
                    {schemaValidation.errors.map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        {issue.path}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
          <p className="section-copy">
            Valid templates can be promoted as reusable environment files for runtime and operations.
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
            <p>Promote valid configuration into the room library for frontend and backend use.</p>
          </div>
        </div>
      </section>

      <section className="panel-surface">
        <div className="section-header">
          <div>
            <span className="eyebrow">Generated Snapshot</span>
            <h3>Live config output</h3>
          </div>
        </div>
        <pre className="code-block">{JSON.stringify(generatedConfig, null, 2)}</pre>
      </section>
    </div>
  );
}
