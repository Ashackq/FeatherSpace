// FeatherSpace App Entry Point
//
// This file sets up the main React Router configuration for the FeatherSpace client.
// It defines all top-level routes, lazy-loads page components for performance,
// and wraps the app in the AppShell layout.

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";

// Define the main router with all application routes.
// Each route uses React Router's lazy loading to split code and improve initial load time.
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        // Home page (dashboard/overview)
        lazy: async () => {
          const module = await import("./pages/HomePage");
          return { Component: module.HomePage };
        },
      },
      {
        path: "rooms",
        // List of available rooms
        lazy: async () => {
          const module = await import("./pages/RoomsPage");
          return { Component: module.RoomsPage };
        },
      },
      {
        path: "rooms/:roomId",
        // Main room experience (spatial UI)
        lazy: async () => {
          const module = await import("./pages/RoomExperiencePage");
          return { Component: module.RoomExperiencePage };
        },
      },
      {
        path: "join/:inviteToken",
        // Invite-based join flow
        lazy: async () => {
          const module = await import("./pages/InviteJoinPage");
          return { Component: module.InviteJoinPage };
        },
      },
      {
        path: "builder",
        // Room environment builder/editor
        lazy: async () => {
          const module = await import("./pages/BuilderPage");
          return { Component: module.BuilderPage };
        },
      },
      {
        path: "ops",
        // Operations/monitoring dashboard
        lazy: async () => {
          const module = await import("./pages/OpsPage");
          return { Component: module.OpsPage };
        },
      },
      {
        path: "settings",
        // User and app settings
        lazy: async () => {
          const module = await import("./pages/SettingsPage");
          return { Component: module.SettingsPage };
        },
      },
      {
        path: "*",
        // Fallback for unknown routes (404)
        lazy: async () => {
          const module = await import("./pages/NotFoundPage");
          return { Component: module.NotFoundPage };
        },
      },
    ],
  },
]);

// App: app.
export function App() {
  return <RouterProvider router={router} />;
}
