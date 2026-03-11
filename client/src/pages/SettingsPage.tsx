import { useMemo, useState } from "react";
import { settingsGroups } from "../data/appData";

export function SettingsPage() {
  const initialValues = useMemo(() => {
    return Object.fromEntries(
      settingsGroups.flatMap((group) => group.fields.map((field) => [field.id, field.defaultValue])),
    );
  }, []);

  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>(initialValues);

  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Settings</span>
        <h2>Prepare a serious configuration surface for users, operators, and demo reviewers.</h2>
        <p>
          Configure device defaults, workspace rules, and presentation settings through a real, structured form surface.
        </p>
      </section>

      <form className="page-stack">
        {settingsGroups.map((group) => (
          <section key={group.title} className="panel-surface settings-section">
            <div className="section-header">
              <div>
                <span className="eyebrow">Config Group</span>
                <h3>{group.title}</h3>
                <p className="section-copy">{group.description}</p>
              </div>
            </div>

            <div className="settings-grid">
              {group.fields.map((field) => {
                const value = formValues[field.id];

                return (
                  <label key={field.id} className={field.type === "checkbox" ? "checkbox-card" : "field-group"}>
                    <span className="field-label">{field.label}</span>
                    {field.type === "select" ? (
                      <select
                        className="input-field"
                        value={String(value)}
                        onChange={(event) =>
                          setFormValues((current) => ({ ...current, [field.id]: event.target.value }))
                        }
                      >
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {field.type === "text" ? (
                      <input
                        className="input-field"
                        type="text"
                        value={String(value)}
                        onChange={(event) =>
                          setFormValues((current) => ({ ...current, [field.id]: event.target.value }))
                        }
                      />
                    ) : null}

                    {field.type === "number" ? (
                      <input
                        className="input-field"
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={Number(value)}
                        onChange={(event) =>
                          setFormValues((current) => ({ ...current, [field.id]: Number(event.target.value) }))
                        }
                      />
                    ) : null}

                    {field.type === "range" ? (
                      <div className="range-field">
                        <input
                          className="slider-field"
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={Number(value)}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, [field.id]: Number(event.target.value) }))
                          }
                        />
                        <strong>{Number(value)}%</strong>
                      </div>
                    ) : null}

                    {field.type === "checkbox" ? (
                      <span className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, [field.id]: event.target.checked }))
                          }
                        />
                        <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </section>
        ))}

        <section className="panel-surface split-callout">
          <div>
            <span className="eyebrow">Review State</span>
            <h3>Configuration now renders from data-driven field definitions.</h3>
          </div>
          <div className="hero-actions">
            <button className="button button-primary" type="submit">
              Save workspace settings
            </button>
            <button className="button button-ghost" type="button">
              Export config snapshot
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
