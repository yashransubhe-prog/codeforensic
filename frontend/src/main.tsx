import React from "react";
import ReactDOM from "react-dom/client";
import RootExperience from "./RootExperience";
import "./styles.css";
import "./workbench.css";
import "./landing.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootExperience />
  </React.StrictMode>,
);
