import {
  Activity,
  AlertTriangle,
  Bug,
  FileCode2,
  Fingerprint,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getIntelligence,
  type IntelligenceIssue,
  type IntelligenceResult,
} from "../lib/intelligence";

import type { Project } from "../types";

type Mode = "ALL" | "BUG" | "SECURITY" | "MALWARE";

function severityRank(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

export default function ForensicWorkbench({
  project,
}: {
  project: Project;
}) {
  const [data, setData] =
    useState<IntelligenceResult | null>(null);
  const [selected, setSelected] =
    useState<IntelligenceIssue | null>(null);
  const [mode, setMode] = useState<Mode>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    getIntelligence(project.id)
      .then((result) => {
        if (cancelled) return;
        setData(result.intelligence);
        setSelected(result.intelligence.issues[0] ?? null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "Analysis failed",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const visibleIssues = useMemo(() => {
    if (!data) return [];

    let result = data.issues;

    if (mode === "BUG") {
      result = result.filter(
        (item) =>
          item.category === "BUG" ||
          item.category === "ERROR",
      );
    }

    if (mode === "SECURITY") {
      result = result.filter(
        (item) =>
          item.category === "SECURITY" ||
          item.category === "SECRET" ||
          item.category === "NETWORK",
      );
    }

    if (mode === "MALWARE") {
      result = result.filter(
        (item) => item.category === "MALWARE",
      );
    }

    const normalized = query.trim().toLowerCase();

    if (normalized) {
      result = result.filter((item) =>
        [
          item.title,
          item.filePath,
          item.evidence,
          item.author ?? "",
          item.category,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      );
    }

    return [...result].sort(
      (a, b) =>
        severityRank(b.severity) -
        severityRank(a.severity),
    );
  }, [data, mode, query]);

  if (loading) {
    return (
      <div className="fw-loading">
        <div className="scanner-orbit">
          <Fingerprint size={28} />
        </div>

        <strong>ANALYZING REPOSITORY EVIDENCE</strong>

        <span>
          Error patterns · malware heuristics · security indicators · attribution
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fw-error">
        <AlertTriangle size={22} />
        {error || "Intelligence unavailable"}
      </div>
    );
  }

  return (
    <div className="forensic-workbench">
      <div className="fw-toolbar">
        <div className="fw-case">
          <Fingerprint size={17} />

          <div>
            <span>ACTIVE INVESTIGATION</span>
            <strong>{project.name}</strong>
          </div>
        </div>

        <div className="fw-search">
          <Search size={14} />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search file, issue, evidence, author..."
          />

          {query && (
            <button onClick={() => setQuery("")}>
              <X size={13} />
            </button>
          )}

          <kbd>CTRL K</kbd>
        </div>

        <div className="fw-health">
          <span className="live-dot" />
          ANALYSIS LIVE
        </div>
      </div>

      <div className="fw-summary">
        <Summary
          icon={<FileCode2 size={15} />}
          label="FILES SCANNED"
          value={data.summary.scannedFiles}
        />
        <Summary
          icon={<Bug size={15} />}
          label="ERROR / BUG SIGNALS"
          value={data.summary.bugSignals}
        />
        <Summary
          icon={<ShieldAlert size={15} />}
          label="SECURITY SIGNALS"
          value={data.summary.securitySignals}
        />
        <Summary
          icon={<Skull size={15} />}
          label="MALWARE SIGNALS"
          value={data.summary.malwareSignals}
        />
        <Summary
          icon={<Activity size={15} />}
          label="MALWARE RISK"
          value={`${data.summary.malwareRisk}/100`}
          danger={data.summary.malwareRisk >= 60}
        />
      </div>

      <div className="fw-main">
        <aside className="fw-left">
          <header>
            <strong>EVIDENCE STREAM</strong>
            <span>{visibleIssues.length} indicators</span>
          </header>

          <div className="fw-filters">
            <Filter
              active={mode === "ALL"}
              onClick={() => setMode("ALL")}
              icon={<Sparkles size={13} />}
              label="All"
              count={data.issues.length}
            />
            <Filter
              active={mode === "BUG"}
              onClick={() => setMode("BUG")}
              icon={<Bug size={13} />}
              label="Errors"
              count={data.bugs.length}
            />
            <Filter
              active={mode === "SECURITY"}
              onClick={() => setMode("SECURITY")}
              icon={<ShieldCheck size={13} />}
              label="Security"
              count={data.security.length}
            />
            <Filter
              active={mode === "MALWARE"}
              onClick={() => setMode("MALWARE")}
              icon={<Skull size={13} />}
              label="Cyber Safe"
              count={data.malware.length}
            />
          </div>

          <div className="fw-issue-list">
            {visibleIssues.map((issue) => (
              <button
                key={issue.id}
                className={
                  selected?.id === issue.id
                    ? "selected"
                    : ""
                }
                onClick={() => setSelected(issue)}
              >
                <span
                  className={`fw-severity-dot ${issue.severity.toLowerCase()}`}
                />

                <div>
                  <div className="fw-issue-top">
                    <strong>{issue.title}</strong>
                    <Severity severity={issue.severity} />
                  </div>

                  <small>
                    {issue.filePath}
                    {issue.line ? `:${issue.line}` : ""}
                  </small>

                  <div className="fw-meta">
                    <span>{issue.category}</span>

                    {issue.author && (
                      <span>
                        <UserRound size={10} />
                        {issue.author}
                      </span>
                    )}

                    <span>
                      {Math.round(issue.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="fw-center">
          {selected ? (
            <>
              <div className="fw-center-head">
                <div>
                  <div className="fw-path">
                    {selected.filePath}
                    {selected.line ? `:${selected.line}` : ""}
                  </div>

                  <h2>{selected.title}</h2>
                </div>

                <Severity
                  severity={selected.severity}
                  large
                />
              </div>

              <div className="fw-code-block">
                <div className="fw-code-title">
                  <span>
                    <FileCode2 size={13} />
                    SOURCE EVIDENCE
                  </span>

                  <span>LINE {selected.line ?? "—"}</span>
                </div>

                <pre>
                  <code>{selected.evidence}</code>
                </pre>
              </div>

              <div className="fw-analysis-grid">
                <AnalysisCard number="01" title="ROOT CAUSE">
                  {selected.cause}
                </AnalysisCard>

                <AnalysisCard number="02" title="POTENTIAL IMPACT">
                  {selected.impact}
                </AnalysisCard>

                <AnalysisCard number="03" title="REMEDIATION">
                  {selected.recommendation}
                </AnalysisCard>

                <AnalysisCard number="04" title="ATTRIBUTION">
                  {selected.author ? (
                    <>
                      <strong>{selected.author}</strong>
                      <span>{selected.authorEmail}</span>
                      {selected.commitHash && (
                        <code>{selected.commitHash}</code>
                      )}
                    </>
                  ) : (
                    "Git attribution unavailable. Import repository history to identify the responsible commit and author."
                  )}
                </AnalysisCard>
              </div>
            </>
          ) : (
            <div className="fw-no-selection">
              <Fingerprint size={30} />
              Select an evidence item
            </div>
          )}
        </section>

        <aside className="fw-right">
          <header>
            <strong>INVESTIGATION CONTEXT</strong>
          </header>

          {selected && (
            <>
              <ContextRow label="CATEGORY" value={selected.category} />
              <ContextRow label="SEVERITY" value={selected.severity} />
              <ContextRow
                label="CONFIDENCE"
                value={`${Math.round(selected.confidence * 100)}%`}
              />
              <ContextRow label="FILE" value={selected.filePath} />
              <ContextRow
                label="LINE"
                value={selected.line?.toString() ?? "Unknown"}
              />
              <ContextRow
                label="AUTHOR"
                value={selected.author ?? "Not recovered"}
              />
              <ContextRow
                label="COMMIT"
                value={
                  selected.commitHash
                    ? selected.commitHash.slice(0, 10)
                    : "Not recovered"
                }
              />
            </>
          )}

          <div className="fw-hotspots">
            <strong>RISK HOTSPOTS</strong>

            {data.hotspots.slice(0, 7).map((item) => (
              <div key={item.filePath}>
                <span>{item.filePath}</span>
                <div>
                  <i style={{ width: `${item.score}%` }} />
                </div>
                <b>{item.score}</b>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="fw-statusbar">
        <span>
          <span className="live-dot" />
          CODEFORENSIC ENGINE
        </span>

        <span>{data.summary.scannedFiles} FILES</span>
        <span>{data.summary.totalIssues} SIGNALS</span>
        <span>{data.summary.suspiciousFiles} HOTSPOTS</span>

        <span className="fw-status-right">
          EVERY CHANGE LEAVES EVIDENCE
        </span>
      </footer>
    </div>
  );
}

function Summary({
  icon,
  label,
  value,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className={`fw-summary-card ${danger ? "danger" : ""}`}>
      <div>
        {icon}
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function Filter({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
      <b>{count}</b>
    </button>
  );
}

function Severity({
  severity,
  large,
}: {
  severity: string;
  large?: boolean;
}) {
  return (
    <span
      className={`fw-severity ${severity.toLowerCase()} ${
        large ? "large" : ""
      }`}
    >
      {severity}
    </span>
  );
}

function AnalysisCard({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="fw-analysis-card">
      <div>
        <span>{number}</span>
        {title}
      </div>
      <p>{children}</p>
    </div>
  );
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="fw-context-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
