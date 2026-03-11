import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        lazy: async () => {
          const module = await import("./pages/HomePage");
          return { Component: module.HomePage };
        },
      },
      {
        path: "rooms",
        lazy: async () => {
          const module = await import("./pages/RoomsPage");
          return { Component: module.RoomsPage };
        },
      },
      {
        path: "rooms/:roomId",
        lazy: async () => {
          const module = await import("./pages/RoomExperiencePage");
          return { Component: module.RoomExperiencePage };
        },
      },
      {
        path: "builder",
        lazy: async () => {
          const module = await import("./pages/BuilderPage");
          return { Component: module.BuilderPage };
        },
      },
      {
        path: "ops",
        lazy: async () => {
          const module = await import("./pages/OpsPage");
          return { Component: module.OpsPage };
        },
      },
      {
        path: "settings",
        lazy: async () => {
          const module = await import("./pages/SettingsPage");
          return { Component: module.SettingsPage };
        },
      },
      {
        path: "*",
        lazy: async () => {
          const module = await import("./pages/NotFoundPage");
          return { Component: module.NotFoundPage };
        },
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
