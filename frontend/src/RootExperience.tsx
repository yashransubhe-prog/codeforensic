import { useEffect, useState } from "react";
import LandingPage from "./components/LandingPage";
import WorldClassApp from "./WorldClassApp";

function hasOAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get("auth_token") && params.get("auth_user"));
}

export default function RootExperience() {
  const [entered, setEntered] = useState(() => hasOAuthReturn() || Boolean(localStorage.getItem("cf_token")));

  useEffect(() => {
    if (hasOAuthReturn()) setEntered(true);
  }, []);

  if (!entered) return <LandingPage onEnter={() => setEntered(true)} />;
  return <WorldClassApp />;
}
