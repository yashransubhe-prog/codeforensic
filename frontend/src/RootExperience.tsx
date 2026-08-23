import { useState } from "react";
import LandingPage from "./components/LandingPage";
import WorldClassApp from "./WorldClassApp";

export default function RootExperience() {
  const params = new URLSearchParams(window.location.search);
  const oauthReturn = params.has("auth_token") && params.has("auth_user");
  const [entered, setEntered] = useState(oauthReturn);

  if (!entered) return <LandingPage onEnter={() => setEntered(true)} />;
  return <WorldClassApp />;
}
