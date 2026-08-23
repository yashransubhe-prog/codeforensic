import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  ChevronRight,
  Code2,
  FileCode2,
  Fingerprint,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import DependencyGraph from "./components/DependencyGraph";
import ForensicWorkbench from "./components/ForensicWorkbench";
import PerformancePanel from "./components/PerformancePanel";
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
  | "ai";

const API = "https://codeforensic.onrender.com";

const NAV = [
  ["investigation", "Investigation", Fingerprint],
  ["overview", "Overview", LayoutDashboard],
  ["dna", "Project DNA", Code2],
  ["timeline", "Git Timeline", GitBranch],
  ["contributors", "Contributors", Users],
  ["dependencies", "Dependency Graph", Boxes],
  ["security", "Cyber Safe", ShieldCheck],
  ["impact", "Impact Analysis", Activity],
  ["performance", "Performance", Gauge],
  ["ai", "Forensic AI", Bot],
] as const;

export default function WorldClassApp() {
  const [user, setUser] = useState(storage.user());
  const [page, setPage] = useState<Page>("investigation");
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setPage("investigation");
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
      setPage("investigation");
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

        <div className="rail-label">FORENSIC WORKSPACE</div>
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
            <div className="command-search">
              <Search size={14} />
              <span>Search evidence, files, findings...</span>
              <kbd>CTRL K</kbd>
            </div>
            <div className="local-status"><span /> ENGINE ONLINE</div>
          </div>
        </header>

        <section className={`workspace ${page === "investigation" ? "workbench-page" : ""}`}>
          {page !== "investigation" && (
            <div className="workspace-title">
              <div>
                <div className="section-code">CF / LIVE PROJECT INTELLIGENCE</div>
                <h1>{project ? project.name : "Forensic Workspace"}</h1>
                <p>Real repository evidence, security signals, architecture and change intelligence.</p>
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
              {page === "overview" && <Overview project={project} totalLines={totalLines} highFindings={highFindings} />}
              {page === "dna" && <ProjectDNA project={project} />}
              {page === "timeline" && <Timeline project={project} />}
              {page === "contributors" && <Contributors project={project} />}
              {page === "dependencies" && (
                <Panel title="Repository Dependency Topology" subtitle={`${project.dependencies.length} real relationships`} full>
                  <DependencyGraph dependencies={project.dependencies} />
                </Panel>
              )}
              {page === "security" && <Security project={project} />}
              {page === "impact" && <Impact project={project} />}
              {page === "performance" && <PerformancePanel project={project} />}
              {page === "ai" && <AIChat project={project} />}
            </>
          )}
        </section>
      </main>

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
    <div className="auth-page">
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

function Overview({ project, totalLines, highFindings }: { project: Project; totalLines: number; highFindings: number }) {
  const maxRisk = project.riskScores.length ? Math.max(...project.riskScores.map((risk) => risk.score)) : 0;
  return (
    <>
      <div className="metric-grid">
        <Metric label="SOURCE FILES" value={project.files.length} detail={`${totalLines.toLocaleString()} lines indexed`} icon={<FileCode2 size={16} />} />
        <Metric label="DEPENDENCIES" value={project.dependencies.length} detail="Internal file relationships" icon={<Boxes size={16} />} />
        <Metric label="SECURITY FINDINGS" value={project.findings.length} detail={`${highFindings} high priority`} icon={<ShieldCheck size={16} />} />
        <Metric label="MAX FILE RISK" value={`${maxRisk}/100`} detail="Highest calculated exposure" icon={<Activity size={16} />} />
      </div>
      <div className="dashboard-grid">
        <Panel title="Architecture Intelligence" subtitle="Interactive repository topology" full>
          <DependencyGraph dependencies={project.dependencies} />
        </Panel>
        <Panel title="Priority Evidence" subtitle="Highest-priority findings">
          <FindingList findings={project.findings.slice(0, 8)} />
        </Panel>
      </div>
    </>
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

function Metric({ label, value, detail, icon }: any) {
  return <div className="metric"><div className="metric-label">{label}{icon}</div><strong>{value}</strong><span>{detail}</span></div>;
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
