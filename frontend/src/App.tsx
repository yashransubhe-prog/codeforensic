import ForensicWorkbench from "./components/ForensicWorkbench";
import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  ChevronRight,
  Code2,
  FileCode2,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getProject,
  importProject,
  listProjects,
  login,
  register,
  storage,
} from "./lib/api";

import DependencyGraph from "./components/DependencyGraph";

import type {
  Finding,
  Project,
} from "./types";

type Page =
  | "workbench"
  | "overview"
  | "dna"
  | "timeline"
  | "contributors"
  | "dependencies"
  | "security"
  | "impact"
  | "ai";

const NAV = [
  
  ["workbench", "Investigation", Fingerprint],
["overview", "Overview", LayoutDashboard],
  ["dna", "Project DNA", Fingerprint],
  ["timeline", "Git Timeline", GitBranch],
  ["contributors", "Contributors", Users],
  ["dependencies", "Dependency Graph", Boxes],
  ["security", "Security Scanner", ShieldCheck],
  ["impact", "Impact Analysis", Activity],
  ["ai", "Forensic AI", Bot],
] as const;

function App() {
  const [user, setUser] = useState(storage.user());
  const [page, setPage] = useState<Page>("workbench");

  const [project, setProject] =
    useState<Project | null>(null);

  const [projects, setProjects] = useState<any[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadProjects() {
    try {
      const result = await listProjects();

      setProjects(result.projects);

      if (!project && result.projects.length) {
        const full = await getProject(result.projects[0].id);
        setProject(full.project);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load projects"
      );
    }
  }

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  if (!user) {
    return (
      <Auth
        onSuccess={(nextUser) => setUser(nextUser)}
      />
    );
  }

  const totalLines =
    project?.files.reduce(
      (sum, file) => sum + (file.lines || 0),
      0
    ) || 0;

  const maxRisk =
    project?.riskScores.length
      ? Math.max(...project.riskScores.map((r) => r.score))
      : 0;

  const critical =
    project?.findings.filter(
      (finding) =>
        finding.severity.toLowerCase() === "critical" ||
        finding.severity.toLowerCase() === "high"
    ).length || 0;

  async function upload(file: File) {
    try {
      setBusy(true);
      setError("");

      const result = await importProject(file);

      setProject(result.project);
      setUploadOpen(false);
      setPage("overview");

      await loadProjects();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Analysis failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cf">
      <aside className="rail">
        <div className="logo">
          <div className="logo-symbol">
            <Fingerprint size={22} />
          </div>

          <div>
            <strong>CODEFORENSIC</strong>
            <span>INVESTIGATE · TRACE · EXPLAIN</span>
          </div>
        </div>

        <div className="rail-label">INVESTIGATION</div>

        <nav>
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={16} />
              {label}

              {page === id && (
                <ChevronRight
                  size={13}
                  className="nav-arrow"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="rail-bottom">
          <div className="engine-state">
            <span className="live-dot" />

            <div>
              <strong>Analysis Engine</strong>
              <small>LOCAL · OPERATIONAL</small>
            </div>
          </div>

          <div className="profile">
            <div className="avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>

            <button
              title="Logout"
              onClick={() => {
                storage.clear();
                setUser(null);
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
            CODEFORENSIC
            <ChevronRight size={12} />
            <strong>
              {NAV.find(([id]) => id === page)?.[1]}
            </strong>
          </div>

          <div className="command-actions">
            <div className="command-search">
              <Search size={14} />
              <span>Search evidence, files, findings...</span>
              <kbd>⌘ K</kbd>
            </div>

            <div className="local-status">
              <span />
              ENGINE ONLINE
            </div>
          </div>
        </header>

        <section className={`workspace ${page === "workbench" ? "workbench-page" : ""}`}>
          <div className="workspace-title">
            <div>
              <div className="section-code">
                CF / INVESTIGATION WORKSPACE
              </div>

              <h1>
                {project
                  ? project.name
                  : "Forensic Workspace"}
              </h1>

              <p>
                Every change leaves evidence. Trace architecture,
                risk, dependencies and repository history from one
                investigation surface.
              </p>
            </div>

            <div className="workspace-actions">
              <select
                value={project?.id || ""}
                onChange={async (event) => {
                  if (!event.target.value) return;

                  const result = await getProject(
                    event.target.value
                  );

                  setProject(result.project);
                }}
              >
                {!projects.length && (
                  <option value="">No projects</option>
                )}

                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <button
                className="primary"
                onClick={() => setUploadOpen(true)}
              >
                <Upload size={15} />
                Import Repository
              </button>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <AlertTriangle size={15} />
              {error}
              <button onClick={() => setError("")}>
                <X size={14} />
              </button>
            </div>
          )}

          {!project ? (
            <EmptyProject
              onImport={() => setUploadOpen(true)}
            />
          ) : (
            <>
              <div className="case-strip">
                <div>
                  <span>CASE</span>
                  <strong>{project.name}</strong>
                </div>

                <div>
                  <span>STATUS</span>
                  <strong className="good">
                    {project.status}
                  </strong>
                </div>

                <div>
                  <span>SOURCE</span>
                  <strong>{project.sourceType}</strong>
                </div>

                <div>
                  <span>FILES</span>
                  <strong>{project.files.length}</strong>
                </div>

                <div>
                  <span>LINES</span>
                  <strong>
                    {totalLines.toLocaleString()}
                  </strong>
                </div>
              </div>

              {page === "workbench" && (
  <ForensicWorkbench project={project} />
)}

{page === "overview" && (
                <Overview
                  project={project}
                  totalLines={totalLines}
                  maxRisk={maxRisk}
                  critical={critical}
                />
              )}

              {page === "dna" && (
                <ProjectDNA project={project} />
              )}

              {page === "timeline" && (
                <Timeline project={project} />
              )}

              {page === "contributors" && (
                <Contributors project={project} />
              )}

              {page === "dependencies" && (
                <Panel
                  title="Repository Dependency Topology"
                  subtitle={`${project.dependencies.length} discovered relationships`}
                  full
                >
                  <DependencyGraph
                    dependencies={project.dependencies}
                  />
                </Panel>
              )}

              {page === "security" && (
                <Security project={project} />
              )}

              {page === "impact" && (
                <Impact project={project} />
              )}

              {page === "ai" && (
                <ForensicAI project={project} />
              )}
            </>
          )}
        </section>
      </main>

      {uploadOpen && (
        <UploadModal
          busy={busy}
          onClose={() => !busy && setUploadOpen(false)}
          onUpload={upload}
        />
      )}
    </div>
  );
}

function Auth({
  onSuccess,
}: {
  onSuccess: (user: any) => void;
}) {
  const [mode, setMode] =
    useState<"login" | "register">("register");

  const [name, setName] = useState("Yash");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setBusy(true);
      setError("");

      const result =
        mode === "register"
          ? await register(name, email, password)
          : await login(email, password);

      storage.save(result.token, result.user);
      onSuccess(result.user);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Authentication failed"
      );
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
        <div className="section-code">
          SECURE INVESTIGATION ACCESS
        </div>

        <h1>
          {mode === "register"
            ? "Create investigator account"
            : "Enter forensic workspace"}
        </h1>

        <p>
          Analyze repository architecture, evidence, security
          findings and change history.
        </p>

        {mode === "register" && (
          <label>
            INVESTIGATOR NAME
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        )}

        <label>
          EMAIL
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          PASSWORD
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {error && (
          <div className="auth-error">{error}</div>
        )}

        <button className="primary auth-submit" disabled={busy}>
          {busy
            ? "AUTHENTICATING..."
            : mode === "register"
            ? "CREATE ACCOUNT"
            : "ACCESS WORKSPACE"}
        </button>

        <button
          type="button"
          className="switch-auth"
          onClick={() =>
            setMode(
              mode === "login" ? "register" : "login"
            )
          }
        >
          {mode === "register"
            ? "Already registered? Sign in"
            : "Need an account? Register"}
        </button>
      </form>
    </div>
  );
}

function Overview({
  project,
  totalLines,
  maxRisk,
  critical,
}: {
  project: Project;
  totalLines: number;
  maxRisk: number;
  critical: number;
}) {
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="SOURCE FILES"
          value={project.files.length}
          detail={`${totalLines.toLocaleString()} lines indexed`}
          icon={<FileCode2 size={16} />}
        />

        <Metric
          label="DEPENDENCIES"
          value={project.dependencies.length}
          detail="Internal relationships"
          icon={<Boxes size={16} />}
        />

        <Metric
          label="SECURITY FINDINGS"
          value={project.findings.length}
          detail={`${critical} high-priority`}
          icon={<ShieldCheck size={16} />}
        />

        <Metric
          label="MAX FILE RISK"
          value={`${maxRisk}/100`}
          detail="Highest calculated exposure"
          icon={<Activity size={16} />}
        />
      </div>

      <div className="dashboard-grid">
        <Panel
          title="Architecture Intelligence"
          subtitle="Live dependency topology extracted from repository"
          full
        >
          <DependencyGraph
            dependencies={project.dependencies}
          />
        </Panel>

        <Panel
          title="Priority Evidence"
          subtitle="Highest severity scanner results"
        >
          <FindingList
            findings={project.findings.slice(0, 6)}
          />
        </Panel>
      </div>
    </>
  );
}

function ProjectDNA({ project }: { project: Project }) {
  const languages = useMemo(() => {
    const map = new Map<string, number>();

    project.files.forEach((file) => {
      const language = file.language || "Other";
      map.set(language, (map.get(language) || 0) + 1);
    });

    return [...map.entries()].sort(
      (a, b) => b[1] - a[1]
    );
  }, [project]);

  return (
    <div className="two-column">
      <Panel
        title="Language Fingerprint"
        subtitle="Repository composition derived from indexed files"
      >
        <div className="language-list">
          {languages.map(([language, count]) => {
            const percent =
              (count / project.files.length) * 100;

            return (
              <div className="language-row" key={language}>
                <div>
                  <strong>{language}</strong>
                  <span>{count} files</span>
                </div>

                <div className="dna-track">
                  <span
                    style={{
                      width: `${percent}%`,
                    }}
                  />
                </div>

                <b>{percent.toFixed(1)}%</b>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Repository Evidence"
        subtitle="Indexed source inventory"
      >
        <div className="file-table">
          {project.files.slice(0, 20).map((file) => (
            <div key={file.id}>
              <Code2 size={13} />
              <span>{file.path}</span>
              <small>
                {(file.lines || 0).toLocaleString()} LOC
              </small>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Timeline({ project }: { project: Project }) {
  return (
    <Panel
      title="Git Evidence Timeline"
      subtitle={`${project.commits.length} commits recovered`}
      full
    >
      {!project.commits.length ? (
        <NoData text="No Git history was present in the imported repository." />
      ) : (
        <div className="timeline">
          {project.commits.map((commit) => (
            <div className="timeline-event" key={commit.id}>
              <div className="timeline-marker" />

              <div>
                <strong>{commit.message}</strong>

                <p>
                  {commit.authorName} ·{" "}
                  {new Date(
                    commit.committedAt
                  ).toLocaleString()}
                </p>

                <code>
                  {commit.hash.substring(0, 10)}
                </code>
              </div>

              <div className="diff">
                <span>+{commit.additions}</span>
                <b>-{commit.deletions}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Contributors({
  project,
}: {
  project: Project;
}) {
  return (
    <Panel
      title="Contributor Attribution"
      subtitle="Authorship reconstructed from repository history"
      full
    >
      {!project.contributors.length ? (
        <NoData text="Contributor history is unavailable for this repository." />
      ) : (
        <div className="contributor-grid">
          {project.contributors.map((person) => (
            <div className="contributor" key={person.id}>
              <div className="avatar">
                {person.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{person.name}</strong>
                <p>{person.email || "No email"}</p>
              </div>

              <div className="contributor-stat">
                <b>{person.commitCount}</b>
                <span>COMMITS</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Security({ project }: { project: Project }) {
  const [selected, setSelected] =
    useState<Finding | null>(
      project.findings[0] || null
    );

  return (
    <div className="security-layout">
      <Panel
        title="Security Findings"
        subtitle={`${project.findings.length} evidence-backed detections`}
      >
        <FindingList
          findings={project.findings}
          selected={selected?.id}
          onSelect={setSelected}
        />
      </Panel>

      <Panel
        title="Evidence Inspector"
        subtitle="Forensic context for selected finding"
      >
        {selected ? (
          <div className="evidence-inspector">
            <div
              className={`severity ${selected.severity.toLowerCase()}`}
            >
              {selected.severity}
            </div>

            <h2>{selected.type}</h2>

            <div className="evidence-location">
              <FileCode2 size={14} />
              {selected.filePath}
              {selected.line
                ? ` : ${selected.line}`
                : ""}
            </div>

            <h4>EVIDENCE</h4>
            <pre>
              {selected.evidence ||
                "Evidence captured by scanner."}
            </pre>

            <h4>WHY THIS MATTERS</h4>
            <p>{selected.description}</p>

            <h4>RECOMMENDATION</h4>
            <p>
              {selected.recommendation ||
                "Review and remediate this finding."}
            </p>

            <div className="confidence">
              SCANNER
              <strong>{selected.scanner}</strong>

              CONFIDENCE
              <strong>
                {selected.confidence != null
                  ? `${Math.round(
                      selected.confidence * 100
                    )}%`
                  : "N/A"}
              </strong>
            </div>
          </div>
        ) : (
          <NoData text="No security findings were detected." />
        )}
      </Panel>
    </div>
  );
}

function Impact({ project }: { project: Project }) {
  const ranked = useMemo(() => {
    const counts = new Map<string, number>();

    project.dependencies.forEach((dep) => {
      counts.set(
        dep.sourceFile,
        (counts.get(dep.sourceFile) || 0) + 1
      );

      counts.set(
        dep.targetFile,
        (counts.get(dep.targetFile) || 0) + 1
      );
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [project]);

  return (
    <div className="two-column">
      <Panel
        title="Change Blast Radius"
        subtitle="Files ranked by dependency connectivity"
      >
        <div className="impact-list">
          {ranked.map(([file, links], index) => (
            <div key={file}>
              <span className="impact-rank">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <strong>{file}</strong>
                <small>
                  {links} dependency relationships
                </small>
              </div>

              <b>{links}</b>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Impact Topology"
        subtitle="Trace propagation across connected files"
      >
        <DependencyGraph
          dependencies={project.dependencies}
        />
      </Panel>
    </div>
  );
}

function ForensicAI({
  project,
}: {
  project: Project;
}) {
  return (
    <div className="ai-investigator">
      <Bot size={30} />

      <div className="section-code">
        PROJECT-AWARE INVESTIGATION ASSISTANT
      </div>

      <h2>Forensic AI</h2>

      <p>
        Investigate {project.name} using repository evidence,
        security findings, dependency relationships and change
        history.
      </p>

      <div className="ai-prompts">
        <button>
          Explain the highest-risk security findings
        </button>
        <button>
          Which files have the largest blast radius?
        </button>
        <button>
          Summarize this repository architecture
        </button>
        <button>
          What should I investigate first?
        </button>
      </div>

      <div className="ai-input">
        <input
          placeholder={`Ask about ${project.name}...`}
        />

        <button>
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: any) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {icon}
      </div>

      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  full,
}: any) {
  return (
    <section className={`panel ${full ? "full" : ""}`}>
      <header>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>

        <div className="panel-code">LIVE DATA</div>
      </header>

      <div className="panel-content">{children}</div>
    </section>
  );
}

function FindingList({
  findings,
  selected,
  onSelect,
}: {
  findings: Finding[];
  selected?: string;
  onSelect?: (finding: Finding) => void;
}) {
  if (!findings.length) {
    return <NoData text="No findings detected." />;
  }

  return (
    <div className="finding-list">
      {findings.map((finding) => (
        <button
          key={finding.id}
          className={
            selected === finding.id ? "selected" : ""
          }
          onClick={() => onSelect?.(finding)}
        >
          <span
            className={`severity-dot ${finding.severity.toLowerCase()}`}
          />

          <div>
            <strong>{finding.type}</strong>
            <small>
              {finding.filePath}
              {finding.line ? `:${finding.line}` : ""}
            </small>
          </div>

          <span
            className={`severity ${finding.severity.toLowerCase()}`}
          >
            {finding.severity}
          </span>
        </button>
      ))}
    </div>
  );
}

function EmptyProject({
  onImport,
}: {
  onImport: () => void;
}) {
  return (
    <div className="empty-project">
      <Fingerprint size={42} />

      <div className="section-code">
        NO ACTIVE INVESTIGATION
      </div>

      <h2>Import a repository to begin</h2>

      <p>
        CodeForensic will index the source tree, extract
        dependencies, inspect security patterns, calculate file
        risk and reconstruct available Git evidence.
      </p>

      <button className="primary" onClick={onImport}>
        <Upload size={15} />
        Import ZIP Repository
      </button>
    </div>
  );
}

function NoData({ text }: { text: string }) {
  return (
    <div className="no-data">
      <Fingerprint size={25} />
      <p>{text}</p>
    </div>
  );
}

function UploadModal({
  onClose,
  onUpload,
  busy,
}: {
  onClose: () => void;
  onUpload: (file: File) => void;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="modal-backdrop">
      <div className="import-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={17} />
        </button>

        <Fingerprint size={29} />

        <div className="section-code">
          NEW FORENSIC INVESTIGATION
        </div>

        <h2>Import repository evidence</h2>

        <p>
          Upload a ZIP archive. Analysis uses the actual
          repository contents; dashboard metrics are not
          pre-generated.
        </p>

        <label className="dropzone">
          <Upload size={25} />

          <strong>
            {file ? file.name : "Select repository ZIP"}
          </strong>

          <span>Maximum archive size: 50 MB</span>

          <input
            hidden
            type="file"
            accept=".zip,application/zip"
            onChange={(e) =>
              setFile(e.target.files?.[0] || null)
            }
          />
        </label>

        <button
          className="primary analyze-button"
          disabled={!file || busy}
          onClick={() => file && onUpload(file)}
        >
          {busy
            ? "EXTRACTING & ANALYZING..."
            : "BEGIN FORENSIC ANALYSIS"}
        </button>
      </div>
    </div>
  );
}

export default App;

