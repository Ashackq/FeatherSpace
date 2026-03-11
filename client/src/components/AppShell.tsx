import { NavLink, Outlet } from "react-router-dom";
import { primaryNavigation } from "../data/appData";

export function AppShell() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img
            className="brand-logo"
            src="/featherspace-logo.svg"
            alt="FeatherSpace"
          />
          <span className="brand-kicker">FeatherSpace</span>
          <h1>Spatial collaboration platform scaffold</h1>
          <p>
            A production-ready frontend shell for rooms, configuration, operations, and demo flows.
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {primaryNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">Coordination Ready</span>
          <p>
            The frontend structure now matches your docs: overview, rooms, builder, ops, and settings.
          </p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Reduced SSR Spatial Platform</span>
            <p className="topbar-copy">
              Product-facing scaffolding now exists independently from realtime implementation details.
            </p>
          </div>
          <div className="topbar-badges">
            <img className="topbar-mark" src="/featherspace-icon.svg" alt="FeatherSpace mark" />
            <span className="status-pill">Prototype UI</span>
            <span className="status-pill status-pill-accent">Frontend Track</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
