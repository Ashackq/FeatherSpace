import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { primaryNavigation } from "../data/appData";

export function AppShell() {
  const [presentationMode, setPresentationMode] = useState<boolean>(() => {
    return window.localStorage.getItem("presentationMode") === "true";
  });
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNavigation = useMemo(() => {
    if (!presentationMode) return primaryNavigation;
    return primaryNavigation.filter((item) => item.to === "/" || item.to === "/rooms" || item.to === "/ops");
  }, [presentationMode]);

  useEffect(() => {
    window.localStorage.setItem("presentationMode", String(presentationMode));
    document.documentElement.dataset.presentation = presentationMode ? "on" : "off";
  }, [presentationMode]);

  useEffect(() => {
    if (!presentationMode) return;
    const hiddenRoutes = new Set(["/builder", "/settings"]);
    if (hiddenRoutes.has(location.pathname)) {
      navigate("/rooms?demo=1", { replace: true });
    }
  }, [location.pathname, navigate, presentationMode]);

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
          <h1>Spatial collaboration platform</h1>
          <p>
            Unified workspace for room discovery, live collaboration, operations, and settings.
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {filteredNavigation.map((item) => (
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

        <div className="sidebar-card presentation-hide">
          <span className="eyebrow">Coordination Ready</span>
          <p>
            The frontend structure now matches your docs: overview, rooms, builder, ops, and settings.
          </p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">FeatherSpace Workspace</span>
            <p className="topbar-copy">
              Core product surfaces stay responsive while realtime services connect in the background.
            </p>
          </div>
          <div className="topbar-badges">
            <img className="topbar-mark" src="/featherspace-icon.svg" alt="FeatherSpace mark" />
            <span className="status-pill">MVP Ready</span>
            <span className="status-pill status-pill-accent">Frontend Track</span>
            <button
              className={`presentation-toggle ${presentationMode ? "presentation-toggle-active" : ""}`}
              type="button"
              onClick={() => setPresentationMode((current) => !current)}
              aria-pressed={presentationMode}
            >
              {presentationMode ? "Presentation Mode: On" : "Presentation Mode: Off"}
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
