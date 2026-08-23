import { Activity, ArrowRight, Bot, Boxes, Code2, Fingerprint, GitBranch, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const team = [
  { name: "YASH", role: "Creator · Main Developer", lead: true },
  { name: "MURLI", role: "Core Team Member" },
  { name: "KALEB", role: "Core Team Member" },
  { name: "USMAN", role: "Support Team" },
  { name: "PARDHU", role: "Support Team" },
  { name: "VIJAY", role: "Support Team" },
  { name: "VARDHAN", role: "Support Team" },
  { name: "REVENTH", role: "Support Team" },
];

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [menu, setMenu] = useState(false);
  const [pointer, setPointer] = useState({ x: 50, y: 30 });

  useEffect(() => {
    const move = (e: PointerEvent) => setPointer({ x: e.clientX / window.innerWidth * 100, y: e.clientY / window.innerHeight * 100 });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenu(false);
  };

  return <div className="landing" style={{ "--mx": `${pointer.x}%`, "--my": `${pointer.y}%` } as React.CSSProperties}>
    <div className="landing-grid" /><div className="cursor-glow" />
    <header className="landing-nav">
      <button className="landing-brand" onClick={() => jump("home")}><span><Fingerprint /></span><div><strong>CODEFORENSIC</strong><small>INVESTIGATE · TRACE · EXPLAIN</small></div></button>
      <nav>{["home", "capabilities", "workflow", "about", "team"].map((x) => <button key={x} onClick={() => jump(x)}>{x.toUpperCase()}</button>)}</nav>
      <button className="enter-tool" onClick={onEnter}>OPEN TOOL <ArrowRight size={15} /></button>
      <button className="mobile-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
    </header>
    {menu && <div className="landing-mobile-nav">{["home", "capabilities", "workflow", "about", "team"].map((x) => <button key={x} onClick={() => jump(x)}>{x.toUpperCase()}</button>)}<button onClick={onEnter}>OPEN TOOL</button></div>}
    <main>
      <section id="home" className="hero">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="eyebrow"><span /> SOFTWARE FORENSICS · LIVE REPOSITORY INTELLIGENCE</div>
        <h1>Every change<br /><em>leaves evidence.</em></h1>
        <p>CodeForensic turns a real software repository into an investigation surface — mapping architecture, dependencies, security evidence, risk, contributors and change impact in one place.</p>
        <div className="hero-actions"><button className="hero-primary" onClick={onEnter}>START INVESTIGATION <ArrowRight /></button><button className="hero-secondary" onClick={() => jump("capabilities")}>EXPLORE PLATFORM</button></div>
        <div className="hero-proof"><span><i /> REAL FILE ANALYSIS</span><span><i /> GITHUB + ZIP</span><span><i /> EVIDENCE-BACKED RISK</span></div>
        <div className="hero-console"><div className="console-head"><span /><span /><span /><b>CF // REPOSITORY TRACE</b></div><div className="console-body"><div className="trace-row"><Fingerprint /><span>repository</span><b>INDEXED</b></div><div className="trace-line" /><div className="trace-cards"><div><Code2 /><strong>FILES</strong><span>Architecture DNA</span></div><div><Boxes /><strong>GRAPH</strong><span>Dependency topology</span></div><div><ShieldCheck /><strong>RISK</strong><span>Evidence + reason</span></div><div><Bot /><strong>AI</strong><span>Project-aware answers</span></div></div></div></div>
      </section>
      <section id="capabilities" className="landing-section"><div className="section-kicker">01 / CAPABILITIES</div><h2>See the repository as<br />an investigation, not a folder.</h2><div className="feature-grid">{[[Fingerprint, "Project DNA", "Index files, languages, line counts and structural evidence from the actual repository."], [Boxes, "Dependency Skeleton", "Explore every indexed file and trace real import relationships, connections and blast radius."], [ShieldCheck, "Cyber Safe", "Find suspicious code patterns with exact file, line, evidence, explanation and remediation."], [Activity, "Impact Analysis", "Identify highly connected files and understand where a change can propagate."], [GitBranch, "Git Evidence", "Import public GitHub repositories and recover commit and contributor evidence."], [Bot, "Forensic AI", "Ask questions about the selected project with repository evidence supplied to the AI backend."]].map(([Icon, title, text]: any, i) => <article key={title}><span className="feature-no">0{i + 1}</span><Icon /><h3>{title}</h3><p>{text}</p><div className="feature-line" /></article>)}</div></section>
      <section id="workflow" className="landing-section workflow"><div><div className="section-kicker">02 / WORKFLOW</div><h2>Import. Trace.<br />Understand.</h2><p>Upload a ZIP or connect a public GitHub repository. CodeForensic indexes the evidence and builds the investigation from the project itself — not fixed demo values.</p><button className="hero-primary" onClick={onEnter}>ANALYZE A REPOSITORY <ArrowRight /></button></div><div className="workflow-steps">{[["01", "INGEST", "ZIP archive or GitHub repository"], ["02", "INDEX", "Files, languages, LOC and metadata"], ["03", "TRACE", "Imports, security signals and risk"], ["04", "INVESTIGATE", "Graphs, evidence, impact and AI"]].map(([n, t, d]) => <div key={n}><b>{n}</b><span /><section><strong>{t}</strong><p>{d}</p></section></div>)}</div></section>
      <section id="about" className="landing-section about"><div className="section-kicker">03 / ABOUT CODEFORENSIC</div><div className="about-grid"><h2>Built to explain<br />what code leaves behind.</h2><div><p>Modern repositories are difficult to understand from files alone. CodeForensic was created as a software-forensics workspace that connects architecture, security, history and impact into a single visual investigation.</p><p>Its principle is simple: <strong>Every change leaves evidence.</strong> The platform helps developers, reviewers and investigators follow that evidence back to the files and relationships that matter.</p><div className="about-values"><span>REAL DATA</span><span>TRACEABLE EVIDENCE</span><span>INTERACTIVE ANALYSIS</span><span>PROJECT-AWARE AI</span></div></div></div></section>
      <section id="team" className="landing-section team"><div className="section-kicker">04 / CREATORS & TEAM</div><h2>The people behind<br />CodeForensic.</h2><div className="team-grid">{team.map((m, i) => <article className={m.lead ? "team-lead" : ""} key={m.name}><div className="member-index">CF-{String(i + 1).padStart(2, "0")}</div><div className="member-avatar">{m.name[0]}</div><div><h3>{m.name}</h3><p>{m.role}</p></div>{m.lead && <Sparkles size={17} />}</article>)}</div></section>
      <section className="landing-cta"><Fingerprint /><div><span>READY TO INVESTIGATE?</span><h2>Trace the evidence inside your code.</h2></div><button className="hero-primary" onClick={onEnter}>GO TO TOOL <ArrowRight /></button></section>
    </main>
    <footer><div className="landing-brand"><span><Fingerprint /></span><div><strong>CODEFORENSIC</strong><small>INVESTIGATE · TRACE · EXPLAIN</small></div></div><p>Software Forensics & Repository Intelligence</p><span>CREATED BY YASH & CODEFORENSIC TEAM</span></footer>
  </div>;
}
