import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Fonts are served from this site (not Google Fonts): nothing render-blocking
// from another server, and visitors' browsers don't contact Google for them.
// Same weights as before; Latin letters only (all the site uses).
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
