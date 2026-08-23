import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { Search, Network, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { Dependency, ProjectFile } from "../types";

interface Props { dependencies: Dependency[]; files?: ProjectFile[] }
const norm = (v: string) => v.replaceAll("\\", "/");
const shortName = (v: string) => norm(v).split("/").pop() || v;
const directoryName = (v: string) => { const p = norm(v).split("/"); p.pop(); return p.join("/") || "root"; };
const API = "https://codeforensic.onrender.com/api";

export default function DependencyGraph({ dependencies, files = [] }: Props) {
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [indexedFiles, setIndexedFiles] = useState<ProjectFile[]>(files);

  useEffect(() => {
    if (files.length) { setIndexedFiles(files); return; }
    const token = localStorage.getItem("cf_token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const projectsResponse = await fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!projectsResponse.ok) return;
        const projectsData = await projectsResponse.json();
        const projectId = projectsData.projects?.[0]?.id;
        if (!projectId) return;
        const projectResponse = await fetch(`${API}/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!projectResponse.ok) return;
        const projectData = await projectResponse.json();
        if (!cancelled && Array.isArray(projectData.project?.files)) setIndexedFiles(projectData.project.files);
      } catch { /* dependency edges still remain usable */ }
    })();
    return () => { cancelled = true; };
  }, [files]);

  const allFiles = useMemo(() => Array.from(new Set([
    ...indexedFiles.map((f) => f.path),
    ...dependencies.flatMap((d) => [d.sourceFile, d.targetFile]),
  ])), [indexedFiles, dependencies]);

  const connected = useMemo(() => {
    const s = new Set<string>();
    if (!selectedFile) return s;
    s.add(selectedFile);
    dependencies.forEach((d) => {
      if (d.sourceFile === selectedFile) s.add(d.targetFile);
      if (d.targetFile === selectedFile) s.add(d.sourceFile);
    });
    return s;
  }, [dependencies, selectedFile]);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return new Set(q ? allFiles.filter((f) => f.toLowerCase().includes(q)) : allFiles);
  }, [allFiles, query]);

  const nodes: Node[] = useMemo(() => {
    const groups = new Map<string, string[]>();
    allFiles.forEach((f) => {
      const dir = directoryName(f);
      const key = dir.split("/").slice(0, 3).join("/") || "root";
      groups.set(key, [...(groups.get(key) || []), f]);
    });
    let y = 0;
    const result: Node[] = [];
    [...groups.values()].forEach((items, groupIndex) => {
      items.forEach((file, i) => {
        const active = !selectedFile || connected.has(file);
        const match = matching.has(file);
        result.push({
          id: file,
          position: { x: (i % 5) * 230 + (groupIndex % 2) * 40, y: y + Math.floor(i / 5) * 100 },
          data: { label: <div className="cf-node-label"><strong>{shortName(file)}</strong><span>{directoryName(file)}</span></div> },
          style: {
            background: selectedFile === file ? "#102b40" : "#09131d",
            border: selectedFile === file ? "1px solid #61c7ff" : "1px solid #29465b",
            color: "#eaf6ff", borderRadius: 9, width: 195, padding: 12,
            opacity: active && match ? 1 : 0.16,
            boxShadow: selectedFile === file ? "0 0 30px rgba(65,184,255,.25)" : "0 8px 30px rgba(0,0,0,.18)",
            transition: "all .25s ease",
          },
        });
      });
      y += Math.ceil(items.length / 5) * 100 + 70;
    });
    return result;
  }, [allFiles, selectedFile, connected, matching]);

  const edges: Edge[] = useMemo(() => dependencies.map((d, i) => ({
    id: `${d.sourceFile}-${d.targetFile}-${i}`, source: d.sourceFile, target: d.targetFile,
    animated: !selectedFile || d.sourceFile === selectedFile || d.targetFile === selectedFile,
    style: {
      stroke: selectedFile && (d.sourceFile === selectedFile || d.targetFile === selectedFile) ? "#61c7ff" : "#385b73",
      strokeWidth: selectedFile ? 1.5 : 1.2,
      opacity: !selectedFile || connected.has(d.sourceFile) || connected.has(d.targetFile) ? 0.9 : 0.08,
    },
  })), [dependencies, selectedFile, connected]);

  if (!allFiles.length) return <div className="graph-empty">No repository files were indexed.</div>;

  return <div className="graph-shell">
    <div className="graph-toolbar"><Network size={16} /><strong>{allFiles.length} FILES · {dependencies.length} IMPORT LINKS</strong>
      <div className="graph-search"><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find any file in repository..." />{query && <button onClick={() => setQuery("")}><X size={12} /></button>}</div>
      {selectedFile && <button className="graph-clear" onClick={() => setSelectedFile(null)}>CLEAR FOCUS</button>}
    </div>
    <div className="dependency-canvas"><ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.04} maxZoom={2.5} onNodeClick={(_, n) => setSelectedFile(n.id)} onPaneClick={() => setSelectedFile(null)} nodesDraggable panOnDrag zoomOnScroll>
      <Background gap={24} size={1} color="#183246" /><Controls /><MiniMap pannable zoomable nodeColor={(n) => n.id === selectedFile ? "#61c7ff" : "#24465b"} maskColor="rgba(3,8,13,.82)" style={{ background: "#071019", border: "1px solid #20394a" }} />
    </ReactFlow></div>
  </div>;
}
