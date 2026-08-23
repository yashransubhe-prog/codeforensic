import React from "react";
import ReactDOM from "react-dom/client";
import WorldClassApp from "./WorldClassApp";
import "./styles.css";
import "./workbench.css";
import "./landing.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WorldClassApp />
  </React.StrictMode>,
);
