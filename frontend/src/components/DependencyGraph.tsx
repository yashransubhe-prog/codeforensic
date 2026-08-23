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
import { useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { Dependency, ProjectFile } from "../types";

interface Props { dependencies: Dependency[]; files?: ProjectFile[] }
const norm = (v: string) => v.replaceAll("\\", "/");
const short = (v: string) => norm(v).split("/").pop() || v;
const dir = (v: string) => { const p = norm(v).split("/"); p.pop(); return p.join("/") || "root"; };

export default function DependencyGraph({ dependencies, files = [] }: Props) {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);

  const links = useMemo(() => dependencies
    .filter(d => d.type !== "FILE_INDEX" && d.sourceFile !== d.targetFile)
    .map(d => ({ ...d, sourceFile: norm(d.sourceFile), targetFile: norm(d.targetFile) })), [dependencies]);

  const paths = useMemo(() => Array.from(new Set([
    ...files.map(f => norm(f.path)),
    ...dependencies.flatMap(d => [norm(d.sourceFile), norm(d.targetFile)])
  ])).filter(Boolean), [files, dependencies]);

  const connected = useMemo(() => {
    const s = new Set<string>();
    if (!focus) return s;
    s.add(focus);
    links.forEach(e => {
      if (e.sourceFile === focus) s.add(e.targetFile);
      if (e.targetFile === focus) s.add(e.sourceFile);
    });
    return s;
  }, [focus, links]);

  const degree = useMemo(() => {
    const m = new Map<string, number>();
    paths.forEach(p => m.set(p, 0));
    links.forEach(e => {
      m.set(e.sourceFile, (m.get(e.sourceFile) || 0) + 1);
      m.set(e.targetFile, (m.get(e.targetFile) || 0) + 1);
    });
    return m;
  }, [paths, links]);

  const nodes: Node[] = useMemo(() => {
    const count = Math.max(paths.length, 1);
    const cx = 640, cy = 360;
    return paths.map((file, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const ring = count <= 8 ? 245 : 230 + (i % 2) * 135;
      const x = cx + Math.cos(angle) * ring;
      const y = cy + Math.sin(angle) * ring;
      const matches = !query || file.toLowerCase().includes(query.toLowerCase());
      const active = !focus || connected.has(file);
      const selected = focus === file;
      const d = degree.get(file) || 0;
      return {
        id: file,
        position: { x, y },
        data: { label: <div className="cf-live-node"><span className="cf-live-orb"/><div><strong>{short(file)}</strong><small>{dir(file)}</small><em>{d} LINK{d === 1 ? "" : "S"}</em></div></div> },
        style: {
          width: 190,
          padding: 11,
          borderRadius: 10,
          border: selected ? "1px solid #72d2ff" : d ? "1px solid #2c7198" : "1px solid #263c4c",
          background: selected ? "#0d2b3d" : "rgba(7,20,30,.94)",
          color: "#eaf6ff",
          opacity: active && matches ? 1 : .13,
          boxShadow: selected ? "0 0 34px rgba(65,194,255,.34)" : d ? "0 0 18px rgba(44,160,220,.10)" : "none",
          transition: "opacity .25s ease, border .25s ease, box-shadow .25s ease, transform .25s ease"
        }
      };
    });
  }, [paths, query, focus, connected, degree]);

  const edges: Edge[] = useMemo(() => links.map((e, i) => {
    const active = !focus || e.sourceFile === focus || e.targetFile === focus;
    return {
      id: `edge-${i}-${e.sourceFile}-${e.targetFile}`,
      source: e.sourceFile,
      target: e.targetFile,
      animated: active,
      markerEnd: { type: MarkerType.ArrowClosed, color: active ? "#55c7ff" : "#28475b", width: 16, height: 16 },
      style: {
        stroke: active ? "#55c7ff" : "#28475b",
        strokeWidth: active ? 2 : 1,
        opacity: active ? .88 : .10,
        filter: active ? "drop-shadow(0 0 4px rgba(68,190,255,.65))" : "none"
      }
    };
  }), [links, focus]);

  if (!paths.length) return <div className="graph-empty">No repository files were indexed.</div>;

  return <div className="graph-shell cf-live-graph">
    <div className="graph-toolbar">
      <Network size={16}/>
      <strong>{paths.length} FILES · {links.length} LIVE DEPENDENCY LINKS</strong>
      <div className="graph-search"><Search size={13}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search live topology..."/>{query && <button onClick={() => setQuery("")}><X size={12}/></button>}</div>
      {focus && <button className="graph-clear" onClick={() => setFocus(null)}>SHOW ALL</button>}
    </div>
    <div className="dependency-canvas cf-live-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: .18, minZoom: .35, maxZoom: 1.1 }}
        minZoom={.15}
        maxZoom={2.4}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        onNodeClick={(_, node) => setFocus(focus === node.id ? null : node.id)}
        onPaneClick={() => setFocus(null)}
      >
        <Background gap={28} size={1} color="#17384b"/>
        <Controls showInteractive={false}/>
        <MiniMap pannable zoomable nodeColor={n => n.id === focus ? "#63d1ff" : "#1e678d"} maskColor="rgba(3,9,14,.80)"/>
      </ReactFlow>
      <div className="cf-live-badge"><span/> LIVE TOPOLOGY · DRAG · ZOOM · PAN · CLICK TO TRACE</div>
    </div>
  </div>;
}
