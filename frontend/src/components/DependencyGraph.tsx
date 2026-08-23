import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  type Edge,
  type Node,
} from "@xyflow/react";
import { Network, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { Dependency, ProjectFile, RiskScore } from "../types";

interface Props {
  dependencies: Dependency[];
  files?: ProjectFile[];
}

type LoadedEvidence = {
  files: ProjectFile[];
  riskScores: RiskScore[];
};

const API = "https://codeforensic.onrender.com/api";
const norm = (v: string) => v.replaceAll("\\", "/");
const short = (v: string) => norm(v).split("/").pop() || v;
const dir = (v: string) => {
  const p = norm(v).split("/");
  p.pop();
  return p.join("/") || "root";
};

function riskTone(score: number) {
  if (score >= 70) return { border: "#ff4f5e", glow: "rgba(255,79,94,.24)", badge: "HIGH" };
  if (score >= 40) return { border: "#f2a52b", glow: "rgba(242,165,43,.20)", badge: "MEDIUM" };
  return { border: "#2f8ee5", glow: "rgba(47,142,229,.18)", badge: "LOW" };
}

export default function DependencyGraph({ dependencies, files = [] }: Props) {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<LoadedEvidence>({ files, riskScores: [] });

  const links = useMemo(
    () =>
      dependencies
        .filter((d) => d.type !== "FILE_INDEX" && d.sourceFile !== d.targetFile)
        .map((d) => ({ ...d, sourceFile: norm(d.sourceFile), targetFile: norm(d.targetFile) })),
    [dependencies],
  );

  useEffect(() => {
    if (files.length) {
      setEvidence((prev) => ({ ...prev, files }));
      return;
    }

    const token = localStorage.getItem("cf_token");
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const listResponse = await fetch(`${API}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listResponse.ok) return;

        const list = await listResponse.json();
        const candidates = Array.isArray(list.projects) ? list.projects : [];
        const wantedPaths = new Set(
          dependencies.flatMap((d) => [norm(d.sourceFile), norm(d.targetFile)]),
        );

        let best: any = null;
        let bestScore = -1;

        for (const item of candidates.slice(0, 30)) {
          const response = await fetch(`${API}/projects/${item.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) continue;
          const data = await response.json();
          const project = data.project;
          if (!project || !Array.isArray(project.files)) continue;

          const candidatePaths = new Set(project.files.map((f: ProjectFile) => norm(f.path)));
          let score = 0;
          wantedPaths.forEach((p) => {
            if (candidatePaths.has(p)) score += 8;
          });
          if ((project.dependencies?.length || 0) === dependencies.length) score += 4;
          score += Math.min(project.files.length, 100) / 100;

          if (score > bestScore) {
            bestScore = score;
            best = project;
          }
        }

        if (!cancelled && best) {
          setEvidence({
            files: Array.isArray(best.files) ? best.files : [],
            riskScores: Array.isArray(best.riskScores) ? best.riskScores : [],
          });
        }
      } catch {
        // Existing dependency evidence still renders even if enrichment fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dependencies, files]);

  const paths = useMemo(
    () =>
      Array.from(
        new Set([
          ...evidence.files.map((f) => norm(f.path)),
          ...dependencies.flatMap((d) => [norm(d.sourceFile), norm(d.targetFile)]),
        ]),
      )
        .filter(Boolean)
        .sort(),
    [evidence.files, dependencies],
  );

  const riskMap = useMemo(() => {
    const map = new Map<string, number>();
    evidence.riskScores.forEach((risk) => map.set(norm(risk.filePath), risk.score));
    return map;
  }, [evidence.riskScores]);

  const incoming = useMemo(() => {
    const map = new Map<string, number>();
    paths.forEach((p) => map.set(p, 0));
    links.forEach((e) => map.set(e.targetFile, (map.get(e.targetFile) || 0) + 1));
    return map;
  }, [paths, links]);

  const outgoing = useMemo(() => {
    const map = new Map<string, number>();
    paths.forEach((p) => map.set(p, 0));
    links.forEach((e) => map.set(e.sourceFile, (map.get(e.sourceFile) || 0) + 1));
    return map;
  }, [paths, links]);

  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!focus) return set;
    set.add(focus);
    links.forEach((e) => {
      if (e.sourceFile === focus) set.add(e.targetFile);
      if (e.targetFile === focus) set.add(e.sourceFile);
    });
    return set;
  }, [focus, links]);

  const levels = useMemo(() => {
    const level = new Map<string, number>();
    const roots = paths.filter((p) => (incoming.get(p) || 0) === 0 && (outgoing.get(p) || 0) > 0);
    const queue = roots.map((p) => ({ file: p, depth: 0 }));

    while (queue.length) {
      const current = queue.shift()!;
      const old = level.get(current.file);
      if (old !== undefined && old <= current.depth) continue;
      level.set(current.file, current.depth);
      links
        .filter((e) => e.sourceFile === current.file)
        .forEach((e) => queue.push({ file: e.targetFile, depth: current.depth + 1 }));
    }

    let max = Math.max(0, ...Array.from(level.values()));
    paths.forEach((p) => {
      if (!level.has(p)) level.set(p, max + 1);
    });
    return level;
  }, [paths, links, incoming, outgoing]);

  const nodes: Node[] = useMemo(() => {
    const grouped = new Map<number, string[]>();
    paths.forEach((p) => {
      const level = levels.get(p) || 0;
      grouped.set(level, [...(grouped.get(level) || []), p]);
    });

    const nodeWidth = 205;
    const gapX = 54;
    const gapY = 155;
    const result: Node[] = [];

    [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .forEach(([level, row]) => {
        row.sort((a, b) => (outgoing.get(b) || 0) - (outgoing.get(a) || 0) || a.localeCompare(b));
        const totalWidth = row.length * nodeWidth + Math.max(0, row.length - 1) * gapX;
        const startX = Math.max(40, 720 - totalWidth / 2);

        row.forEach((file, index) => {
          const score = riskMap.get(file) || 0;
          const tone = riskTone(score);
          const isEntry = (incoming.get(file) || 0) === 0 && (outgoing.get(file) || 0) > 0;
          const matches = !query || file.toLowerCase().includes(query.toLowerCase());
          const active = !focus || connected.has(file);
          const selected = focus === file;
          const out = outgoing.get(file) || 0;
          const inc = incoming.get(file) || 0;

          result.push({
            id: file,
            position: { x: startX + index * (nodeWidth + gapX), y: 55 + level * gapY },
            data: {
              label: (
                <div className="cf-live-node">
                  <span className="cf-live-orb" />
                  <div>
                    <strong>{short(file)}</strong>
                    <small>{dir(file)}</small>
                    <em>
                      {isEntry ? "ENTRY · " : ""}{out} OUT · {inc} IN
                      {score ? ` · RISK ${score}` : ""}
                    </em>
                  </div>
                </div>
              ),
            },
            style: {
              width: nodeWidth,
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${isEntry ? "#61d868" : tone.border}`,
              background: selected ? "#102d40" : "rgba(7,18,28,.97)",
              color: "#edf8ff",
              opacity: active && matches ? 1 : 0.12,
              boxShadow: selected
                ? "0 0 36px rgba(95,205,255,.32)"
                : `0 0 22px ${tone.glow}`,
              transition: "opacity .25s ease, border .25s ease, box-shadow .25s ease",
            },
          });
        });
      });

    return result;
  }, [paths, levels, incoming, outgoing, riskMap, query, focus, connected]);

  const edges: Edge[] = useMemo(
    () =>
      links.map((e, i) => {
        const sourceRisk = riskMap.get(e.sourceFile) || 0;
        const targetRisk = riskMap.get(e.targetFile) || 0;
        const maxRisk = Math.max(sourceRisk, targetRisk);
        const color = maxRisk >= 70 ? "#ff4d5b" : maxRisk >= 40 ? "#f2a52b" : "#45c96b";
        const active = !focus || e.sourceFile === focus || e.targetFile === focus;

        return {
          id: `edge-${i}-${e.sourceFile}-${e.targetFile}`,
          source: e.sourceFile,
          target: e.targetFile,
          animated: active,
          type: "smoothstep",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 18,
            height: 18,
          },
          label: active ? "imports" : undefined,
          labelStyle: { fill: "#7093aa", fontSize: 8, fontWeight: 600 },
          labelBgStyle: { fill: "#07111a", fillOpacity: 0.9 },
          style: {
            stroke: color,
            strokeWidth: active ? 2.2 : 1,
            opacity: active ? 0.96 : 0.08,
            filter: active ? `drop-shadow(0 0 4px ${color})` : "none",
          },
        };
      }),
    [links, focus, riskMap],
  );

  if (!paths.length) return <div className="graph-empty">No repository files were indexed.</div>;

  return (
    <div className="graph-shell cf-live-graph">
      <div className="graph-toolbar">
        <Network size={16} />
        <strong>{paths.length} FILES · {links.length} VERIFIED IMPORT LINKS</strong>
        <div className="graph-search">
          <Search size={13} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search every indexed file..."
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
        {focus && <button className="graph-clear" onClick={() => setFocus(null)}>SHOW ALL</button>}
      </div>

      <div className="cf-graph-legend">
        <span><i className="entry" /> Entry/root</span>
        <span><i className="high" /> High risk</span>
        <span><i className="medium" /> Medium risk</span>
        <span><i className="low" /> Low/no risk</span>
        <span className="line-key">→ verified import direction</span>
        <span className="accuracy-note">Unconnected files are still shown — no fake dependencies are invented.</span>
      </div>

      <div className="dependency-canvas cf-live-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.28, maxZoom: 1.05 }}
          minZoom={0.12}
          maxZoom={2.5}
          nodesDraggable
          nodesConnectable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          onNodeClick={(_, node) => setFocus(focus === node.id ? null : node.id)}
          onPaneClick={() => setFocus(null)}
        >
          <Background gap={28} size={1} color="#17384b" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.id === focus ? "#63d1ff" : "#245b7a")}
            maskColor="rgba(3,9,14,.78)"
          />
        </ReactFlow>
        <div className="cf-live-badge"><span /> LIVE TOPOLOGY · DRAG · ZOOM · PAN · CLICK TO TRACE</div>
      </div>
    </div>
  );
}
