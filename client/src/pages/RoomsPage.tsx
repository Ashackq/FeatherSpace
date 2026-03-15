import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { roomFilters, roomLaunchDefaults, roomTemplates } from "../data/appData";

export function RoomsPage() {
  const [launchConfig, setLaunchConfig] = useState(roomLaunchDefaults);
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";

  const guidedTemplate = useMemo(() => {
    return roomTemplates.find((room) => room.id === "research-studio") ?? roomTemplates[0];
  }, []);

  useEffect(() => {
    if (!demoMode || !guidedTemplate) return;

    setLaunchConfig((current) => ({
      ...current,
      roomName: guidedTemplate.name,
      mode: guidedTemplate.type,
      capacity: Number.parseInt(guidedTemplate.capacity, 10),
      talkRadius: guidedTemplate.defaults.talkRadius,
      maxPeers: guidedTemplate.defaults.maxPeers,
      environmentFile: guidedTemplate.environment,
      allowGuests: true,
    }));
  }, [demoMode, guidedTemplate]);

  return (
    <div className="page-stack">
      {demoMode ? (
        <section className="panel-surface split-callout demo-flow-panel">
          <div>
            <span className="eyebrow">Guided Demo</span>
            <h3>Step 1 of 2: launch the prepared research studio room.</h3>
          </div>
          <div className="hero-actions">
            <Link className="button button-primary" to="/rooms/research-studio?demo=1">
              Continue to live room
            </Link>
          </div>
        </section>
      ) : null}

      <section className="panel-surface section-banner">
        <span className="eyebrow">Room Directory</span>
        <h2>Template-rich room surfaces for presentations, collaboration, and critique.</h2>
        <p>
          Browse room templates, adjust launch settings, and move directly into a room-ready runtime surface.
        </p>
      </section>

      <section className="room-page-grid">
        <div className="page-stack">
          <section className="panel-surface filter-toolbar">
            <div className="field-group">
              <label className="field-label" htmlFor="roomSearch">
                Search rooms
              </label>
              <input id="roomSearch" className="input-field" type="search" placeholder={roomFilters.searchPlaceholder} />
            </div>
            <div className="field-row field-row-inline">
              <div className="field-group">
                <label className="field-label" htmlFor="roomMode">
                  Mode
                </label>
                <select id="roomMode" className="input-field">
                  {roomFilters.modes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="roomCapacityRange">
                  Capacity band
                </label>
                <select id="roomCapacityRange" className="input-field">
                  {roomFilters.capacities.map((capacity) => (
                    <option key={capacity}>{capacity}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card-grid three-up">
            {roomTemplates.map((room) => (
              <article key={room.id} className="room-card">
                <div className="room-card-header">
                  <span className="room-type">{room.type}</span>
                  <span className="room-capacity">{room.capacity}</span>
                </div>
                <h3>{room.name}</h3>
                <p>{room.summary}</p>
                <dl className="room-meta-list">
                  <div className="room-meta-wide">
                    <dt>Environment</dt>
                    <dd>{room.environment}</dd>
                  </div>
                  <div>
                    <dt>Interactive zones</dt>
                    <dd>{room.zoneCount}</dd>
                  </div>
                  <div>
                    <dt>Talk radius</dt>
                    <dd>{room.defaults.talkRadius}px</dd>
                  </div>
                </dl>
                <div className="room-card-footer">
                  <Link className="button button-primary" to={`/rooms/${room.id}`}>
                    Enter room
                  </Link>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() =>
                      setLaunchConfig((current) => ({
                        ...current,
                        roomName: room.name,
                        mode: room.type,
                        capacity: Number.parseInt(room.capacity, 10),
                        talkRadius: room.defaults.talkRadius,
                        maxPeers: room.defaults.maxPeers,
                        environmentFile: room.environment,
                        allowGuests: room.defaults.stageMode,
                      }))
                    }
                  >
                    Load config
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>

        <aside className="panel-surface form-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Launch Config</span>
              <h3>Room startup form</h3>
            </div>
          </div>

          <form className="settings-form">
            <div className="field-group">
              <label className="field-label" htmlFor="roomName">
                Session name
              </label>
              <input
                id="roomName"
                className="input-field"
                value={launchConfig.roomName}
                onChange={(event) => setLaunchConfig((current) => ({ ...current, roomName: event.target.value }))}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="hostName">
                Host name
              </label>
              <input
                id="hostName"
                className="input-field"
                value={launchConfig.hostName}
                onChange={(event) => setLaunchConfig((current) => ({ ...current, hostName: event.target.value }))}
              />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="launchMode">
                  Mode
                </label>
                <select
                  id="launchMode"
                  className="input-field"
                  value={launchConfig.mode}
                  onChange={(event) => setLaunchConfig((current) => ({ ...current, mode: event.target.value }))}
                >
                  {roomFilters.modes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="capacity">
                  Capacity
                </label>
                <input
                  id="capacity"
                  className="input-field"
                  type="number"
                  min={4}
                  max={40}
                  value={launchConfig.capacity}
                  onChange={(event) =>
                    setLaunchConfig((current) => ({
                      ...current,
                      capacity: Number(event.target.value),
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
                  value={launchConfig.talkRadius}
                  onChange={(event) =>
                    setLaunchConfig((current) => ({
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
                  value={launchConfig.maxPeers}
                  onChange={(event) =>
                    setLaunchConfig((current) => ({
                      ...current,
                      maxPeers: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="environmentFile">
                Environment file
              </label>
              <input
                id="environmentFile"
                className="input-field"
                value={launchConfig.environmentFile}
                onChange={(event) =>
                  setLaunchConfig((current) => ({ ...current, environmentFile: event.target.value }))
                }
              />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={launchConfig.allowGuests}
                onChange={(event) =>
                  setLaunchConfig((current) => ({ ...current, allowGuests: event.target.checked }))
                }
              />
              <span>Allow guest access to the room</span>
            </label>

            <div className="hero-actions">
              <Link className="button button-primary" to={demoMode ? "/rooms/research-studio?demo=1" : "/rooms/research-studio"}>
                Start room preview
              </Link>
              <button className="button button-ghost presentation-hide" type="button">
                Save template draft
              </button>
            </div>
          </form>
        </aside>
      </section>

      <section className="panel-surface split-callout">
        <div>
          <span className="eyebrow">Runtime Ready</span>
          <h3>The room route supports participant rails, overlays, and live media control behavior.</h3>
        </div>
        <p>
          Directory and runtime surfaces are now separate on purpose, which makes it easier to scale the app without collapsing everything into one page.
        </p>
      </section>
    </div>
  );
}
