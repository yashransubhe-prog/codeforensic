import {
  Activity,
  Cpu,
  HardDrive,
  MonitorCog,
  Play,
  Pause,
  Trash2,
  Wifi,
  AlertTriangle,
  Bot,
  Boxes,
  ChevronRight,
  Code2,
  FileCode2,
  Fingerprint,
  Globe2,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import DependencyGraph from "./components/DependencyGraph";
import ForensicWorkbench from "./components/ForensicWorkbench";
import PerformancePanel from "./components/PerformancePanel";
import WebsiteAudit from "./components/WebsiteAudit";
import {
  askAI,
  getProject,
  importGithubProject,
  importProject,
  listProjects,
  login,
  register,
  storage,
} from "./lib/api";
import type { Finding, Project } from "./types";

type Page =
  | "investigation"
  | "overview"
  | "dna"
  | "timeline"
  | "contributors"
  | "dependencies"
  | "security"
  | "impact"
  | "performance"
  | "website"
  | "ai";

const API = "https://codeforensic.onrender.com";

const NAV = [
  ["overview", "Command Center", LayoutDashboard],
  ["investigation", "Evidence Explorer", Fingerprint],
  ["dependencies", "Dependency Map", Boxes],
  ["security", "Security", ShieldCheck],
  ["website", "Website X-Ray", Globe2],
  ["timeline", "Change History", GitBranch],
  ["ai", "Forensic AI", Bot],
] as const;

export default function WorldClassApp() {
  const [user, setUser] = useState(storage.user());
  const [page, setPage] = useState<Page>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("cf_theme") === "light" ? "light" : "dark"));

  useEffect(() => { const go=(e:any)=>setPage(e.detail as Page); window.addEventListener("cf:navigate",go); return()=>window.removeEventListener("cf:navigate",go); },[]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("cf_theme", theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("auth_token");
    const encodedUser = params.get("auth_user");

    if (token && encodedUser) {
      try {
        const parsedUser = JSON.parse(decodeURIComponent(atob(encodedUser)));
        storage.save(token, parsedUser);
        setUser(parsedUser);
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        // Ignore malformed OAuth callback payloads.
      }
    }
  }, []);

  async function refreshProjects(selectId?: string) {
    const result = await listProjects();
    setProjects(result.projects);

    const target =
      selectId || project?.id || result.projects[0]?.id;

    if (target) {
      const full = await getProject(target);
      setProject(full.project);
    }
  }

  useEffect(() => {
    if (!user) return;
    refreshProjects().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "Unable to load projects"),
    );
  }, [user]);

  async function handleZip(file: File) {
    setBusy(true);
    setError("");
    try {
      const result = await importProject(file);
      setProject(result.project);
      setImportOpen(false);
      setPage("overview");
      await refreshProjects(result.project.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Repository analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGithub(url: string) {
    setBusy(true);
    setError("");
    try {
      const result = await importGithubProject(url);
      setProject(result.project);
      setImportOpen(false);
      setPage("overview");
      await refreshProjects(result.project.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "GitHub analysis failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <AuthScreen onSuccess={setUser} />;
  }

  const totalLines = project?.files.reduce((sum, file) => sum + (file.lines || 0), 0) || 0;
  const highFindings = project?.findings.filter((finding) =>
    ["high", "critical"].includes(finding.severity.toLowerCase()),
  ).length || 0;

  return (
    <div className="cf">
      <aside className="rail">
        <div className="logo">
          <div className="logo-symbol"><Fingerprint size={22} /></div>
          <div>
            <strong>CODEFORENSIC</strong>
            <span>INVESTIGATE · TRACE · EXPLAIN</span>
          </div>
        </div>

        <div className="rail-label">INVESTIGATION WORKSPACE</div>
        <nav>
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={16} />
              {label}
              {page === id && <ChevronRight size={13} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        <div className="rail-bottom">
          <div className="engine-state">
            <span className="live-dot" />
            <div>
              <strong>Analysis Engine</strong>
              <small>CLOUD · OPERATIONAL</small>
            </div>
          </div>

          <div className="profile">
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button
              title="Logout"
              onClick={() => {
                storage.clear();
                setUser(null);
                setProject(null);
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="workbench">
        <header className="commandbar">
          <div className="crumb">
            CODEFORENSIC <ChevronRight size={12} />
            <strong>{NAV.find(([id]) => id === page)?.[1]}</strong>
          </div>
          <div className="command-actions">
            <button className={`background-monitor-trigger ${monitorOpen ? "active" : ""}`} onClick={() => setMonitorOpen(!monitorOpen)}><Activity size={14}/><span>Background Monitor</span><i/></button>
            <div className="command-search">
              <Search size={14} />
              <span>Search this investigation...</span>
              <kbd>CTRL K</kbd>
            </div>
            <button className="theme-toggle" title="Toggle light/dark mode" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}</button>
            <div className="local-status"><span /> ENGINE ONLINE</div>
          </div>
        </header>

        <section className={`workspace ${page === "investigation" ? "workbench-page" : ""}`}>
          {page !== "investigation" && (
            <div className="workspace-title">
              <div>
                <div className="section-code">CODEFORENSIC / ACTIVE INVESTIGATION</div>
                <h1>{project ? project.name : "Forensic Workspace"}</h1>
                <p>Understand what is inside this project, what needs attention, what it affects, and why.</p>
              </div>
              <div className="workspace-actions">
                <select
                  value={project?.id || ""}
                  onChange={async (event) => {
                    if (!event.target.value) return;
                    const result = await getProject(event.target.value);
                    setProject(result.project);
                  }}
                >
                  {!projects.length && <option value="">No projects</option>}
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <button className="primary" onClick={() => setImportOpen(true)}>
                  <Upload size={15} /> Import Repository
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <AlertTriangle size={15} /> {error}
              <button onClick={() => setError("")}><X size={14} /></button>
            </div>
          )}

          {!project ? (
            <EmptyProject onImport={() => setImportOpen(true)} />
          ) : (
            <>
              {page !== "investigation" && (
                <div className="case-strip">
                  <div><span>CASE</span><strong>{project.name}</strong></div>
                  <div><span>STATUS</span><strong className="good">{project.status}</strong></div>
                  <div><span>SOURCE</span><strong>{project.sourceType}</strong></div>
                  <div><span>FILES</span><strong>{project.files.length}</strong></div>
                  <div><span>LINES</span><strong>{totalLines.toLocaleString()}</strong></div>
                </div>
              )}

              {page === "investigation" && <ForensicWorkbench project={project} />}
              {page === "overview" && <Overview project={project} totalLines={totalLines} highFindings={highFindings} onNavigate={setPage} />}
              {page === "dna" && <ProjectDNA project={project} />}
              {page === "timeline" && <Timeline project={project} />}
              {page === "contributors" && <Contributors project={project} />}
              {page === "dependencies" && (
                <Panel title="Repository Dependency Topology" subtitle={`${project.dependencies.length} real relationships`} full>
                  <DependencyGraph dependencies={project.dependencies} files={project.files} />
                </Panel>
              )}
              {page === "security" && <Security project={project} />}
              {page === "impact" && <Impact project={project} />}
              {page === "performance" && <PerformancePanel project={project} />}
              {page === "website" && <WebsiteAudit />}
              {page === "ai" && <AIChat project={project} />}
            </>
          )}
        </section>
      </main>

      <BackgroundMonitor open={monitorOpen} onToggle={() => setMonitorOpen(!monitorOpen)} project={project} />

      {importOpen && (
        <ImportModal
          busy={busy}
          onClose={() => !busy && setImportOpen(false)}
          onZip={handleZip}
          onGithub={handleGithub}
        />
      )}
    </div>
  );
}

function AuthScreen({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authPointer, setAuthPointer] = useState({ x: 50, y: 50 });

  function trackAuthPointer(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setAuthPointer({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "register"
        ? await register(name, email, password)
        : await login(email, password);
      storage.save(result.token, result.user);
      onSuccess(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page" onPointerMove={trackAuthPointer} style={{ "--ax": `${authPointer.x}%`, "--ay": `${authPointer.y}%` } as React.CSSProperties}>
      <aside className="auth-visual" style={{ display: "block", visibility: "visible", opacity: 1, position: "relative", width: "100%", height: "calc(100vh - 36px)", minHeight: 620, overflow: "hidden", borderRadius: 28, background: "#06090f", border: "1px solid #182131", zIndex: 10 }}>
        <div className="forensic-stage" style={{ "--mx": `${authPointer.x}%`, "--my": `${authPointer.y}%` } as React.CSSProperties}>
          <div className="fs-grid" />
          <div className="fs-aurora" />
          <div className="fs-scanline" />
          <div className="fs-reticle" />
          <svg className="fs-links" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
            <path className="p1" d="M160 205 C300 205 330 315 470 345" />
            <path className="p2" d="M470 345 C635 320 700 190 850 205" />
            <path className="p3" d="M470 345 C625 390 690 520 845 510" />
            <circle cx="470" cy="345" r="5" /><circle cx="160" cy="205" r="4" /><circle cx="850" cy="205" r="4" /><circle cx="845" cy="510" r="4" />
          </svg>

          <div className="fs-node fs-node-code"><Code2 size={17}/><div><b>server.ts</b><span>ENTRY EVIDENCE</span></div><em>TRACE</em></div>
          <div className="fs-node fs-node-sec"><ShieldCheck size={17}/><div><b>security</b><span>4 SIGNALS</span></div><em>SCAN</em></div>
          <div className="fs-node fs-node-dep"><Boxes size={17}/><div><b>dependency</b><span>IMPACT PATH</span></div><em>MAP</em></div>

          <div className="fs-core">
            <div className="fs-ring r1"/><div className="fs-ring r2"/><div className="fs-ring r3"/>
            <div className="fs-eye e1"><i style={{ transform: `translate(${(authPointer.x-50)*0.10}px,${(authPointer.y-50)*0.08}px)` }}/></div>
            <div className="fs-eye e2"><i style={{ transform: `translate(${(authPointer.x-50)*0.10}px,${(authPointer.y-50)*0.08}px)` }}/></div>
            <Fingerprint size={62}/>
            <strong>CF</strong><small>FORENSIC CORE</small>
          </div>

          <div className="fs-pulse pulse-a"/><div className="fs-pulse pulse-b"/><div className="fs-pulse pulse-c"/>
          <div className="fs-pointer"><span/>INSPECTING</div>

          <div className="fs-copy">
            <span>CODEFORENSIC / LIVE INVESTIGATION ENGINE</span>
            <h2>Evidence moves<br/>when you do.</h2>
            <p>Move your cursor across the field to trace code, security signals and dependency paths.</p>
            <div className="fs-steps"><b>01</b> INGEST <i/><b>02</b> TRACE <i/><b>03</b> EXPLAIN</div>
          </div>
        </div>
      </aside>
      <div className="auth-brand">
        <Fingerprint size={30} />
        <div>
          <strong>CODEFORENSIC</strong>
          <span>INVESTIGATE · TRACE · EXPLAIN</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="section-code">SECURE INVESTIGATION ACCESS</div>
        <h1>{mode === "register" ? "Create investigator account" : "Enter forensic workspace"}</h1>
        <p>Analyze errors, contributors, dependencies, malware signals and project performance.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => { window.location.href = `${API}/api/auth/google`; }}
          >
            <span style={{ fontWeight: 900 }}>G</span> Continue with Google
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => { window.location.href = `${API}/api/auth/github`; }}
          >
            <GitBranch size={15} /> Continue with GitHub
          </button>
        </div>

        {mode === "register" && (
          <label>
            INVESTIGATOR NAME
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
        )}
        <label>
          EMAIL
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          PASSWORD
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        </label>

        {error && <div className="auth-error">{error}</div>}
        <button className="primary auth-submit" disabled={busy}>
          {busy ? "AUTHENTICATING..." : mode === "register" ? "CREATE ACCOUNT" : "ACCESS WORKSPACE"}
        </button>
        <button type="button" className="switch-auth" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "register" ? "Already registered? Sign in" : "Need an account? Register"}
        </button>
      </form>
    </div>
  );
}

function Overview({ project, totalLines, highFindings, onNavigate }: { project: Project; totalLines: number; highFindings: number; onNavigate: (page: Page) => void }) {
  const maxRisk = project.riskScores.length ? Math.max(...project.riskScores.map((risk) => risk.score)) : 0;
  const topFinding = project.findings.find((f) => ["critical","high"].includes(f.severity.toLowerCase())) || project.findings[0];
  const connectedFiles = new Set(project.dependencies.flatMap((d) => [d.sourceFile,d.targetFile])).size;
  const health = Math.max(0, Math.min(100, Math.round(100 - maxRisk * .55 - Math.min(25, highFindings * 6))));
  const nextAction = topFinding ? `Review ${topFinding.type} in ${topFinding.filePath.split("/").pop()}` : project.dependencies.length ? "Explore the dependency map to understand architecture" : "Review indexed files and repository structure";
  return (
    <div className="command-center">
      <section className="cc-hero">
        <div>
          <span className="cc-eyebrow">INVESTIGATION SUMMARY</span>
          <h2>Here is what CodeForensic found.</h2>
          <p>This page turns the scan into decisions: what needs attention, where it lives, and what to inspect next.</p>
        </div>
        <div className="cc-health"><span>PROJECT HEALTH</span><strong>{health}</strong><small>/100</small></div>
      </section>

      <section className="cc-priority">
        <div className="cc-priority-icon"><Activity size={20}/></div>
        <div><span>RECOMMENDED NEXT STEP</span><strong>{nextAction}</strong><p>{topFinding ? "A detected finding has evidence and remediation guidance ready to review." : "No high-priority finding is currently available, so start with architecture evidence."}</p></div>
        <button onClick={() => onNavigate(topFinding ? "security" : "dependencies")}>Investigate <ChevronRight size={16}/></button>
      </section>

      <div className="cc-kpis">
        <button onClick={() => onNavigate("investigation")}><span>CODEBASE</span><strong>{project.files.length}</strong><p>files · {totalLines.toLocaleString()} lines</p><small>Browse evidence →</small></button>
        <button onClick={() => onNavigate("security")} className={highFindings ? "attention" : ""}><span>SECURITY</span><strong>{project.findings.length}</strong><p>{highFindings} high-priority findings</p><small>Review findings →</small></button>
        <button onClick={() => onNavigate("dependencies")}><span>ARCHITECTURE</span><strong>{project.dependencies.length}</strong><p>verified links · {connectedFiles} connected files</p><small>Open map →</small></button>
        <button onClick={() => onNavigate("timeline")}><span>CHANGE HISTORY</span><strong>{project.commits.length}</strong><p>commits recovered</p><small>Trace changes →</small></button>
      </div>

      <div className="cc-grid">
        <section className="cc-explain">
          <header><div><span>START HERE</span><h3>What can I do with this project?</h3></div></header>
          <div className="cc-actions">
            <button onClick={() => onNavigate("security")}><ShieldCheck/><div><strong>Find risky code</strong><p>See the exact file, line, evidence, why it matters and how to fix it.</p></div><ChevronRight/></button>
            <button onClick={() => onNavigate("dependencies")}><Boxes/><div><strong>Understand relationships</strong><p>See which files depend on each other and trace a change's direct impact.</p></div><ChevronRight/></button>
            <button onClick={() => onNavigate("timeline")}><GitBranch/><div><strong>Trace who changed what</strong><p>Use recovered Git history to connect commits and contributors to the codebase.</p></div><ChevronRight/></button>
            <button onClick={() => onNavigate("ai")}><Bot/><div><strong>Ask the repository</strong><p>Ask plain-language questions and get answers grounded in this project's evidence.</p></div><ChevronRight/></button>
          </div>
        </section>
        <section className="cc-evidence">
          <header><span>TOP EVIDENCE</span><h3>Needs attention</h3><p>Highest-priority observations from this scan.</p></header>
          <FindingList findings={project.findings.slice(0,5)} onSelect={() => onNavigate("security")} />
          {!project.findings.length && <NoData text="No security findings detected in this scan."/>}
        </section>
      </div>
    </div>
  );
}

function ProjectDNA({ project }: { project: Project }) {
  const languages = useMemo(() => {
    const map = new Map<string, number>();
    project.files.forEach((file) => map.set(file.language || "Other", (map.get(file.language || "Other") || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [project]);

  return (
    <div className="two-column">
      <Panel title="Language Fingerprint" subtitle="Repository composition">
        <div className="language-list">
          {languages.map(([language, count]) => {
            const percent = project.files.length ? (count / project.files.length) * 100 : 0;
            return (
              <div className="language-row" key={language}>
                <div><strong>{language}</strong><span>{count} files</span></div>
                <div className="dna-track"><span style={{ width: `${percent}%` }} /></div>
                <b>{percent.toFixed(1)}%</b>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Repository Evidence" subtitle="Indexed source inventory">
        <div className="file-table">
          {project.files.slice(0, 30).map((file) => (
            <div key={file.id}><Code2 size={13} /><span>{file.path}</span><small>{(file.lines || 0).toLocaleString()} LOC</small></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Timeline({ project }: { project: Project }) {
  return (
    <Panel title="Git Evidence Timeline" subtitle={`${project.commits.length} commits recovered`} full>
      {!project.commits.length ? <NoData text="No Git history was recovered for this import." /> : (
        <div className="timeline">
          {project.commits.map((commit) => (
            <div className="timeline-event" key={commit.id}>
              <div className="timeline-marker" />
              <div><strong>{commit.message}</strong><p>{commit.authorName} · {new Date(commit.committedAt).toLocaleString()}</p><code>{commit.hash.substring(0, 10)}</code></div>
              <div className="diff"><span>+{commit.additions}</span><b>-{commit.deletions}</b></div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Contributors({ project }: { project: Project }) {
  return (
    <Panel title="Contributor Attribution" subtitle="Authorship from GitHub / repository history" full>
      {!project.contributors.length ? <NoData text="Import through GitHub to recover contributor history when available." /> : (
        <div className="contributor-grid">
          {project.contributors.map((person) => (
            <div className="contributor" key={person.id}>
              <div className="avatar">{person.name.charAt(0).toUpperCase()}</div>
              <div><strong>{person.name}</strong><p>{person.email || "No email"}</p></div>
              <div className="contributor-stat"><b>{person.commitCount}</b><span>COMMITS</span></div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Security({ project }: { project: Project }) {
  const [selected, setSelected] = useState<Finding | null>(project.findings[0] || null);
  useEffect(() => setSelected(project.findings[0] || null), [project.id]);

  return (
    <div className="security-layout">
      <Panel title="Cyber Safe Findings" subtitle={`${project.findings.length} evidence-backed detections`}>
        <FindingList findings={project.findings} selected={selected?.id} onSelect={setSelected} />
      </Panel>
      <Panel title="Evidence Inspector" subtitle="Exact location, reason and recommendation">
        {selected ? (
          <div className="evidence-inspector">
            <div className={`severity ${selected.severity.toLowerCase()}`}>{selected.severity}</div>
            <h2>{selected.type}</h2>
            <div className="evidence-location"><FileCode2 size={14} />{selected.filePath}{selected.line ? ` : ${selected.line}` : ""}</div>
            <h4>EVIDENCE</h4><pre>{selected.evidence || "Evidence captured by scanner."}</pre>
            <h4>WHY THIS MATTERS</h4><p>{selected.description}</p>
            <h4>RECOMMENDATION</h4><p>{selected.recommendation || "Review and remediate this finding."}</p>
            <div className="confidence">SCANNER<strong>{selected.scanner}</strong>CONFIDENCE<strong>{selected.confidence == null ? "N/A" : `${Math.round(selected.confidence * 100)}%`}</strong></div>
          </div>
        ) : <NoData text="No security findings were detected." />}
      </Panel>
    </div>
  );
}

function Impact({ project }: { project: Project }) {
  const ranked = useMemo(() => {
    const counts = new Map<string, number>();
    project.dependencies.forEach((edge) => {
      counts.set(edge.sourceFile, (counts.get(edge.sourceFile) || 0) + 1);
      counts.set(edge.targetFile, (counts.get(edge.targetFile) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [project]);

  return (
    <div className="two-column">
      <Panel title="Change Blast Radius" subtitle="Files ranked by dependency connectivity">
        <div className="impact-list">
          {ranked.map(([file, links], index) => (
            <div key={file}><span className="impact-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{file}</strong><small>{links} dependency relationships</small></div><b>{links}</b></div>
          ))}
        </div>
      </Panel>
      <Panel title="Impact Topology" subtitle="Click a node to isolate its direct blast radius">
        <DependencyGraph dependencies={project.dependencies} />
      </Panel>
    </div>
  );
}

function AIChat({ project }: { project: Project }) {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [busy, setBusy] = useState(false);

  async function send(text = message) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setHistory((current) => [...current, { role: "user", text: trimmed }]);
    setMessage("");
    setBusy(true);
    try {
      const result = await askAI(trimmed, project.id);
      const answer = result.answer || result.message || result.response || "No response returned.";
      setHistory((current) => [...current, { role: "ai", text: answer }]);
    } catch (reason) {
      setHistory((current) => [...current, { role: "ai", text: reason instanceof Error ? reason.message : "AI request failed" }]);
    } finally {
      setBusy(false);
    }
  }

  const prompts = [
    "Explain the highest-risk finding and where it is",
    "Which files have the biggest blast radius?",
    "Summarize the repository architecture",
    "What should I investigate first and why?",
  ];

  return (
    <div className="ai-investigator" style={{ alignItems: "stretch" }}>
      <Bot size={30} />
      <div className="section-code">PROJECT-AWARE FORENSIC AI</div>
      <h2>Ask CodeForensic about {project.name}</h2>
      <p>Answers are requested with the current project id so the backend can ground them in repository evidence.</p>
      <div className="ai-prompts">{prompts.map((prompt) => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}</div>
      <div style={{ minHeight: 220, display: "grid", gap: 8, alignContent: "start", marginTop: 12 }}>
        {history.map((item, index) => (
          <div key={index} className={`bubble ${item.role === "user" ? "user" : "ai"}`}>{item.text}</div>
        ))}
      </div>
      <div className="ai-input">
        <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} placeholder={`Ask about ${project.name}...`} />
        <button onClick={() => send()} disabled={busy}><ChevronRight size={17} /></button>
      </div>
    </div>
  );
}


function BackgroundMonitor({ open, onToggle, project }: { open:boolean; onToggle:()=>void; project:Project|null }) {
  const [running,setRunning]=useState(true);
  const [fps,setFps]=useState<number|null>(null);
  const [longTasks,setLongTasks]=useState(0);
  const [heap,setHeap]=useState<{used:number;limit:number}|null>(null);
  const [deviceMemory,setDeviceMemory]=useState<number|null>(null);
  const [online,setOnline]=useState(navigator.onLine);
  const [samples,setSamples]=useState<number[]>([]);
  useEffect(()=>{
    if(!running)return;
    let raf=0,frames=0,last=performance.now(),sampleStart=last;
    const tick=(now:number)=>{frames++;if(now-last>=1000){const value=Math.round(frames*1000/(now-last));setFps(value);setSamples(v=>[...v.slice(-19),value]);frames=0;last=now;}raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);
    const PerfObs=(window as any).PerformanceObserver;let observer:any;
    try{observer=new PerfObs((list:any)=>setLongTasks((v)=>v+list.getEntries().length));observer.observe({entryTypes:["longtask"]});}catch{}
    const timer=window.setInterval(()=>{const mem=(performance as any).memory;if(mem)setHeap({used:mem.usedJSHeapSize,limit:mem.jsHeapSizeLimit});const dm=(navigator as any).deviceMemory;if(dm)setDeviceMemory(dm);},1500);
    const on=()=>setOnline(navigator.onLine);window.addEventListener("online",on);window.addEventListener("offline",on);
    return()=>{cancelAnimationFrame(raf);observer?.disconnect();clearInterval(timer);window.removeEventListener("online",on);window.removeEventListener("offline",on)};
  },[running]);
  const avg=samples.length?Math.round(samples.reduce((a,b)=>a+b,0)/samples.length):null;
  const heapPct=heap?Math.round(heap.used/heap.limit*100):null;
  const findings=project?.findings.length||0, high=project?.findings.filter(f=>["high","critical"].includes(f.severity.toLowerCase())).length||0;
  return <aside className={`bg-monitor ${open?"open":""}`} onMouseEnter={()=>{}} onClick={(e)=>e.stopPropagation()}>
    <button className="bg-monitor-tab" onClick={onToggle}><Activity size={15}/><span>LIVE</span><i/></button>
    <div className="bg-monitor-inner">
      <header><div><small>LOCAL SESSION TELEMETRY</small><strong>Background Monitor</strong><p>Live measurements for this CodeForensic browser tab plus evidence from the active repository.</p></div><button onClick={()=>setRunning(!running)}>{running?<Pause/>:<Play/>}{running?"Pause":"Resume"}</button></header>
      <div className="monitor-status"><span className={running?"pulse":""}/><b>{running?"MEASURING NOW":"PAUSED"}</b><em>{online?"Network online":"Network offline"}</em></div>
      <div className="monitor-grid">
        <div><MonitorCog/><span>RENDER RATE</span><strong>{fps??"—"} <small>FPS</small></strong><p>{avg? `${avg} FPS recent average`:"Collecting frames…"}</p></div>
        <div><Cpu/><span>MAIN-THREAD PRESSURE</span><strong>{longTasks}</strong><p>Long tasks observed in this session. Lower is better.</p></div>
        <div><HardDrive/><span>WEB-APP MEMORY</span><strong>{heapPct===null?"—":heapPct+"%"}</strong><p>{heap? `${(heap.used/1048576).toFixed(1)} MB JS heap in use`:"Browser does not expose JS heap telemetry."}</p></div>
        <div><Wifi/><span>CONNECTIVITY</span><strong>{online?"ONLINE":"OFFLINE"}</strong><p>Browser network state, not an internet speed test.</p></div>
      </div>
      <section className="monitor-chart"><div><b>FRAME STABILITY</b><span>last {samples.length} seconds</span></div><div className="spark">{samples.map((v,i)=><i key={i} style={{height:`${Math.max(8,Math.min(100,v/60*100))}%`}}/>)}</div></section>
      <section className="monitor-evidence"><h4>ACTIVE SOFTWARE EVIDENCE</h4><div><span>Repository</span><b>{project?.name||"No project selected"}</b></div><div><span>Indexed files</span><b>{project?.files.length??"—"}</b></div><div><span>Verified relationships</span><b>{project?.dependencies.length??"—"}</b></div><div><span>Security findings</span><b>{findings} total · {high} high priority</b></div><div><span>Approx. device RAM</span><b>{deviceMemory?deviceMemory+" GB":"Not exposed by browser"}</b></div></section>
      <section className="monitor-truth"><ShieldCheck/><div><b>Capability boundary</b><p>Browser mode can measure this tab and analyze uploaded/web evidence. Full-device virus scanning, process cleanup, RAM clearing and system-wide optimization require a separately installed CodeForensic desktop agent with explicit OS permission.</p></div></section>
      <div className="monitor-actions"><button onClick={()=>{performance.clearMarks();performance.clearMeasures();setLongTasks(0);setSamples([])}}><Trash2/>Clear telemetry history</button><button onClick={()=>setPageSafe("security")} disabled={!project}><ShieldCheck/>Open repository security</button></div>
    </div>
  </aside>;
  function setPageSafe(target:string){window.dispatchEvent(new CustomEvent("cf:navigate",{detail:target}));onToggle();}
}

function Panel({ title, subtitle, children, full }: any) {
  return <section className={`panel ${full ? "full" : ""}`}><header><div><strong>{title}</strong><span>{subtitle}</span></div><div className="panel-code">LIVE DATA</div></header><div className="panel-content">{children}</div></section>;
}

function FindingList({ findings, selected, onSelect }: { findings: Finding[]; selected?: string; onSelect?: (finding: Finding) => void }) {
  if (!findings.length) return <NoData text="No findings detected." />;
  return (
    <div className="finding-list">
      {findings.map((finding) => (
        <button key={finding.id} className={selected === finding.id ? "selected" : ""} onClick={() => onSelect?.(finding)}>
          <span className={`severity-dot ${finding.severity.toLowerCase()}`} />
          <div><strong>{finding.type}</strong><small>{finding.filePath}{finding.line ? `:${finding.line}` : ""}</small></div>
          <span className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyProject({ onImport }: { onImport: () => void }) {
  return (
    <div className="empty-project">
      <Fingerprint size={42} />
      <div className="section-code">NO ACTIVE INVESTIGATION</div>
      <h2>Import repository evidence</h2>
      <p>Upload a ZIP or connect a public GitHub repository. CodeForensic will analyze real files, dependencies, security signals and available commit evidence.</p>
      <button className="primary" onClick={onImport}><Upload size={15} /> Import Repository</button>
    </div>
  );
}

function NoData({ text }: { text: string }) {
  return <div className="no-data"><Fingerprint size={25} /><p>{text}</p></div>;
}

function ImportModal({
  onClose,
  onZip,
  onGithub,
  busy,
}: {
  onClose: () => void;
  onZip: (file: File) => void;
  onGithub: (url: string) => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<"zip" | "github">("zip");
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");

  return (
    <div className="modal-backdrop">
      <div className="import-modal">
        <button className="modal-close" onClick={onClose}><X size={17} /></button>
        <Fingerprint size={29} />
        <div className="section-code">NEW FORENSIC INVESTIGATION</div>
        <h2>Import repository evidence</h2>
        <p>Analyze a ZIP from your computer or a public GitHub repository directly.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <button type="button" className={`btn ${mode === "zip" ? "primary" : "secondary"}`} onClick={() => setMode("zip")}><Upload size={14} /> ZIP Upload</button>
          <button type="button" className={`btn ${mode === "github" ? "primary" : "secondary"}`} onClick={() => setMode("github")}><GitBranch size={14} /> GitHub URL</button>
        </div>

        {mode === "zip" ? (
          <label className="dropzone">
            <Upload size={25} />
            <strong>{file ? file.name : "Select repository ZIP"}</strong>
            <span>Maximum archive size: 50 MB</span>
            <input hidden type="file" accept=".zip,application/zip" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
        ) : (
          <label>
            PUBLIC GITHUB REPOSITORY
            <input
              value={githubUrl}
              onChange={(event) => setGithubUrl(event.target.value)}
              placeholder="https://github.com/owner/repository"
              style={{ width: "100%", marginTop: 7, background: "#0d121a", border: "1px solid #273044", borderRadius: 7, padding: 12, color: "#dce2ee" }}
            />
          </label>
        )}

        <button
          className="primary analyze-button"
          disabled={busy || (mode === "zip" ? !file : !githubUrl.trim())}
          onClick={() => mode === "zip" ? file && onZip(file) : onGithub(githubUrl)}
        >
          {busy ? "IMPORTING & ANALYZING..." : "BEGIN FORENSIC ANALYSIS"}
        </button>
      </div>
    </div>
  );
}
