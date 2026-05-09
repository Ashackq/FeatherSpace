// main.tsx: Application entry point.
//
// Mounts the root React component (App) into the DOM.
// Also imports global styles for the application.

import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Mount the React app into the #root DOM element
ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />,
);
