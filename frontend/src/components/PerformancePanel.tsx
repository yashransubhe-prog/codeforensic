import {
  Activity,
  AlertTriangle,
  FileWarning,
  Gauge,
  Network,
  PackageSearch,
  Rocket,
  TestTube2,
} from "lucide-react";
import { useMemo } from "react";

import type { Project } from "../types";

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export default function PerformancePanel({ project }: { project: Project }) {
  const analysis = useMemo(() => {
    const totalBytes = project.files.reduce((sum, file) => sum + file.sizeBytes, 0);
    const totalLines = project.files.reduce((sum, file) => sum + (file.lines || 0), 0);
    const testFiles = project.files.filter((file) => file.isTest).length;
    const largeFiles = [...project.files]
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 12);

    const connectivity = new Map<string, number>();
    project.dependencies.forEach((edge) => {
      connectivity.set(edge.sourceFile, (connectivity.get(edge.sourceFile) || 0) + 1);
      connectivity.set(edge.targetFile, (connectivity.get(edge.targetFile) || 0) + 1);
    });

    const hotspots = [...connectivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const hugeSourceFiles = project.files.filter(
      (file) => (file.lines || 0) > 500 || file.sizeBytes > 150_000,
    );
    const noTestRatio = project.files.length
      ? Math.round((testFiles / project.files.length) * 100)
      : 0;
    const highRisk = project.riskScores.filter((risk) => risk.score >= 60).length;

    const deductions =
      Math.min(30, hugeSourceFiles.length * 4) +
      Math.min(25, highRisk * 5) +
      (noTestRatio < 10 && project.files.length > 10 ? 15 : 0) +
      (hotspots[0]?.[1] && hotspots[0][1] > 20 ? 10 : 0);

    const score = Math.max(0, 100 - deductions);

    const recommendations: Array<{
      severity: "HIGH" | "MEDIUM" | "LOW";
      title: string;
      detail: string;
    }> = [];

    if (hugeSourceFiles.length) {
      recommendations.push({
        severity: "HIGH",
        title: "Split oversized modules",
        detail: `${hugeSourceFiles.length} file(s) are large enough to slow review, testing, bundling or change isolation.`,
      });
    }
    if (hotspots[0]?.[1] && hotspots[0][1] > 12) {
      recommendations.push({
        severity: "MEDIUM",
        title: "Reduce dependency hotspots",
        detail: `${hotspots[0][0]} has ${hotspots[0][1]} dependency relationships and may create a large change blast radius.`,
      });
    }
    if (noTestRatio < 10 && project.files.length > 10) {
      recommendations.push({
        severity: "MEDIUM",
        title: "Increase automated test coverage",
        detail: `Only ${noTestRatio}% of indexed files are recognized as tests. Add tests around high-risk and high-connectivity modules first.`,
      });
    }
    if (highRisk) {
      recommendations.push({
        severity: "HIGH",
        title: "Resolve high-risk files before optimization",
        detail: `${highRisk} file(s) have a risk score of 60 or higher. Security and correctness issues should be fixed before micro-optimizing runtime performance.`,
      });
    }
    if (!recommendations.length) {
      recommendations.push({
        severity: "LOW",
        title: "Repository structure looks healthy",
        detail: "No major structural performance warning was detected from current repository evidence.",
      });
    }

    return {
      totalBytes,
      totalLines,
      testFiles,
      testRatio: noTestRatio,
      score,
      highRisk,
      hugeSourceFiles,
      largeFiles,
      hotspots,
      recommendations,
    };
  }, [project]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="metric-grid">
        <Metric icon={<Gauge size={15} />} label="HEALTH SCORE" value={`${analysis.score}/100`} detail="Structure + risk + test signals" />
        <Metric icon={<Activity size={15} />} label="SOURCE VOLUME" value={bytes(analysis.totalBytes)} detail={`${analysis.totalLines.toLocaleString()} indexed lines`} />
        <Metric icon={<TestTube2 size={15} />} label="TEST SIGNAL" value={`${analysis.testRatio}%`} detail={`${analysis.testFiles} recognized test files`} />
        <Metric icon={<FileWarning size={15} />} label="LARGE MODULES" value={analysis.hugeSourceFiles.length} detail="500+ LOC or 150 KB+" />
      </div>

      <div className="two-column">
        <section className="panel">
          <header>
            <div>
              <strong>Optimization Intelligence</strong>
              <span>Repository-specific actions ranked from live project evidence</span>
            </div>
            <div className="panel-code">REAL SIGNALS</div>
          </header>
          <div className="panel-content">
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {analysis.recommendations.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  style={{
                    border: "1px solid #1d2d39",
                    background: "#0a1118",
                    borderRadius: 6,
                    padding: 13,
                    display: "grid",
                    gridTemplateColumns: "30px 1fr",
                    gap: 10,
                  }}
                >
                  <div style={{ color: item.severity === "HIGH" ? "#ff6d77" : item.severity === "MEDIUM" ? "#efbd59" : "#5ed4a2" }}>
                    {item.severity === "HIGH" ? <AlertTriangle size={17} /> : <Rocket size={17} />}
                  </div>
                  <div>
                    <strong style={{ fontSize: 10, color: "#cad5de" }}>{item.title}</strong>
                    <p style={{ margin: "6px 0 0", color: "#667b8b", fontSize: 8, lineHeight: 1.6 }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <header>
            <div>
              <strong>Dependency Hotspots</strong>
              <span>Files with the highest structural blast radius</span>
            </div>
            <div className="panel-code">LIVE DATA</div>
          </header>
          <div className="panel-content">
            <div className="impact-list">
              {analysis.hotspots.map(([file, links], index) => (
                <div key={file}>
                  <span className="impact-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{file}</strong>
                    <small>{links} dependency relationships</small>
                  </div>
                  <b>{links}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="panel full">
        <header>
          <div>
            <strong>Largest Files</strong>
            <span>Prioritize bundle, parse, review and maintainability hotspots</span>
          </div>
          <div className="panel-code">{analysis.largeFiles.length} FILES</div>
        </header>
        <div className="panel-content">
          <div className="file-table">
            {analysis.largeFiles.map((file) => (
              <div key={file.id}>
                <PackageSearch size={13} />
                <span>{file.path}</span>
                <small>{bytes(file.sizeBytes)} · {(file.lines || 0).toLocaleString()} LOC</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
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
