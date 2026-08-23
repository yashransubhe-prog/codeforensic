import React from "react";
import ReactDOM from "react-dom/client";
import RootExperience from "./RootExperience";
import "./styles.css";
import "./workbench.css";
import "./landing.css";
import "./polish.css";
import "./mobile.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootExperience />
  </React.StrictMode>,
);
