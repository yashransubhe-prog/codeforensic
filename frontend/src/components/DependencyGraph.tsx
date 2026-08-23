import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { Network, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { Dependency, ProjectFile } from "../types";

interface Props { dependencies: Dependency[]; files?: ProjectFile[] }
const API = "https://codeforensic.onrender.com/api";
const norm = (v: string) => v.replaceAll("\\", "/");
const shortName = (v: string) => norm(v).split("/").pop() || v;
const directoryName = (v: string) => { const p = norm(v).split("/"); p.pop(); return p.join("/") || "root"; };

export default function DependencyGraph({ dependencies, files = [] }: Props) {
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [resolvedFiles, setResolvedFiles] = useState<ProjectFile[]>(files);

  const realDependencies = useMemo(
    () => dependencies.filter((d) => d.type !== "FILE_INDEX" && d.sourceFile !== d.targetFile),
    [dependencies],
  );

  useEffect(() => {
    if (files.length) { setResolvedFiles(files); return; }
    const token = localStorage.getItem("cf_token");
    if (!token) return;
    let cancelled = false;
    const evidencePaths = new Set(dependencies.flatMap((d) => [norm(d.sourceFile), norm(d.targetFile)]));

    (async () => {
      try {
        const listResponse = await fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!listResponse.ok) return;
        const list = await listResponse.json();
        const candidates = Array.isArray(list.projects) ? list.projects : [];
        let bestFiles: ProjectFile[] = [];
        let bestScore = -1;

        for (const candidate of candidates) {
          const response = await fetch(`${API}/projects/${candidate.id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!response.ok) continue;
          const data = await response.json();
          const candidateFiles: ProjectFile[] = Array.isArray(data.project?.files) ? data.project.files : [];
          const candidatePaths = new Set(candidateFiles.map((f) => norm(f.path)));
          const score = evidencePaths.size
            ? [...evidencePaths].filter((path) => candidatePaths.has(path)).length
            : candidateFiles.length;
          if (score > bestScore) { bestScore = score; bestFiles = candidateFiles; }
          if (evidencePaths.size && score === evidencePaths.size) break;
        }
        if (!cancelled && bestFiles.length) setResolvedFiles(bestFiles);
      } catch { /* dependency evidence itself remains renderable */ }
    })();
    return () => { cancelled = true; };
  }, [files, dependencies]);

  const allFiles = useMemo(() => Array.from(new Set([
    ...resolvedFiles.map((f) => norm(f.path)),
    ...dependencies.flatMap((d) => [norm(d.sourceFile), norm(d.targetFile)]),
  ])).sort(), [resolvedFiles, dependencies]);

  const connected = useMemo(() => {
    const s = new Set<string>();
    if (!selectedFile) return s;
    s.add(selectedFile);
    realDependencies.forEach((d) => {
      const source = norm(d.sourceFile); const target = norm(d.targetFile);
      if (source === selectedFile) s.add(target);
      if (target === selectedFile) s.add(source);
    });
    return s;
  }, [realDependencies, selectedFile]);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return new Set(q ? allFiles.filter((f) => f.toLowerCase().includes(q)) : allFiles);
  }, [allFiles, query]);

  const nodes: Node[] = useMemo(() => {
    const columns = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(allFiles.length))));
    return allFiles.map((file, index) => {
      const active = !selectedFile || connected.has(file);
      const match = matching.has(file);
      return {
        id: file,
        position: { x: (index % columns) * 245, y: Math.floor(index / columns) * 115 },
        data: { label: <div className="cf-node-label"><strong>{shortName(file)}</strong><span>{directoryName(file)}</span></div> },
        style: {
          background: selectedFile === file ? "#102b40" : "#09131d",
          border: selectedFile === file ? "1px solid #61c7ff" : "1px solid #29465b",
          color: "#eaf6ff", borderRadius: 9, width: 205, padding: 12,
          opacity: active && match ? 1 : 0.15,
          boxShadow: selectedFile === file ? "0 0 30px rgba(65,184,255,.25)" : "0 8px 30px rgba(0,0,0,.2)",
          transition: "opacity .2s ease, border .2s ease, box-shadow .2s ease",
        },
      };
    });
  }, [allFiles, selectedFile, connected, matching]);

  const edges: Edge[] = useMemo(() => realDependencies.map((d, i) => {
    const source = norm(d.sourceFile); const target = norm(d.targetFile);
    return {
      id: `${source}-${target}-${i}`, source, target,
      animated: !selectedFile || source === selectedFile || target === selectedFile,
      style: {
        stroke: selectedFile && (source === selectedFile || target === selectedFile) ? "#61c7ff" : "#385b73",
        strokeWidth: selectedFile ? 1.6 : 1.25,
        opacity: !selectedFile || connected.has(source) || connected.has(target) ? 0.95 : 0.08,
      },
    };
  }), [realDependencies, selectedFile, connected]);

  if (!allFiles.length) return <div className="graph-empty">No repository files were indexed.</div>;

  return <div className="graph-shell">
    <div className="graph-toolbar">
      <Network size={16} /><strong>{allFiles.length} FILES · {realDependencies.length} REAL IMPORT LINKS</strong>
      <div className="graph-search"><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find any file in repository..." />{query && <button onClick={() => setQuery("")}><X size={12} /></button>}</div>
      {selectedFile && <button className="graph-clear" onClick={() => setSelectedFile(null)}>CLEAR FOCUS</button>}
    </div>
    <div className="dependency-canvas">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.25, minZoom: 0.25, maxZoom: 1.2 }} minZoom={0.08} maxZoom={2.5} onNodeClick={(_, n) => setSelectedFile(n.id)} onPaneClick={() => setSelectedFile(null)} nodesDraggable panOnDrag zoomOnScroll>
        <Background gap={24} size={1} color="#183246" /><Controls /><MiniMap pannable zoomable nodeColor={(n) => n.id === selectedFile ? "#61c7ff" : "#24465b"} maskColor="rgba(3,8,13,.82)" style={{ background: "#071019", border: "1px solid #20394a" }} />
      </ReactFlow>
    </div>
  </div>;
}
