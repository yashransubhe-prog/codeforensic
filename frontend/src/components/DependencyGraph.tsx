import { Network, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dependency, ProjectFile } from "../types";

interface Props {
  dependencies: Dependency[];
  files?: ProjectFile[];
}

type PositionedFile = {
  file: string;
  directory: string;
  x: number;
  y: number;
};

const API = "https://codeforensic.onrender.com/api";
const normalize = (value: string) => value.replaceAll("\\", "/");
const shortName = (value: string) => normalize(value).split("/").pop() || value;
const directoryName = (value: string) => {
  const parts = normalize(value).split("/");
  parts.pop();
  return parts.join("/") || "root";
};

function edgeKey(edge: Dependency) {
  return `${normalize(edge.sourceFile)}->${normalize(edge.targetFile)}:${edge.type}`;
}

export default function DependencyGraph({ dependencies, files = [] }: Props) {
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [resolvedFiles, setResolvedFiles] = useState<ProjectFile[]>(files);

  const realDependencies = useMemo(
    () =>
      dependencies
        .filter((edge) => edge.type !== "FILE_INDEX" && edge.sourceFile !== edge.targetFile)
        .map((edge) => ({
          ...edge,
          sourceFile: normalize(edge.sourceFile),
          targetFile: normalize(edge.targetFile),
        })),
    [dependencies],
  );

  useEffect(() => {
    if (files.length) {
      setResolvedFiles(files);
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

        const listData = await listResponse.json();
        const projects = Array.isArray(listData.projects) ? listData.projects.slice(0, 20) : [];
        const wantedEdges = new Set(dependencies.map(edgeKey));
        const wantedPaths = new Set(
          dependencies.flatMap((edge) => [normalize(edge.sourceFile), normalize(edge.targetFile)]),
        );

        let bestFiles: ProjectFile[] = [];
        let bestScore = -1;

        for (const item of projects) {
          const response = await fetch(`${API}/projects/${item.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) continue;

          const data = await response.json();
          const candidate = data.project;
          if (!candidate || !Array.isArray(candidate.files)) continue;

          const candidateEdges = new Set(
            (candidate.dependencies || []).map((edge: Dependency) => edgeKey(edge)),
          );
          const candidatePaths = new Set(
            candidate.files.map((file: ProjectFile) => normalize(file.path)),
          );

          let score = 0;
          wantedEdges.forEach((key) => {
            if (candidateEdges.has(key)) score += 5;
          });
          wantedPaths.forEach((path) => {
            if (candidatePaths.has(path)) score += 1;
          });
          if (candidate.dependencies?.length === dependencies.length) score += 2;

          if (score > bestScore) {
            bestScore = score;
            bestFiles = candidate.files;
          }
        }

        if (!cancelled && bestFiles.length) setResolvedFiles(bestFiles);
      } catch {
        // The graph can still render dependency-linked files if lookup fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dependencies, files]);

  const allFiles = useMemo(() => {
    const values = new Set<string>();
    resolvedFiles.forEach((file) => values.add(normalize(file.path)));
    dependencies.forEach((edge) => {
      values.add(normalize(edge.sourceFile));
      values.add(normalize(edge.targetFile));
    });
    return [...values].filter(Boolean).sort();
  }, [resolvedFiles, dependencies]);

  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!selectedFile) return set;
    set.add(selectedFile);
    realDependencies.forEach((edge) => {
      if (edge.sourceFile === selectedFile) set.add(edge.targetFile);
      if (edge.targetFile === selectedFile) set.add(edge.sourceFile);
    });
    return set;
  }, [realDependencies, selectedFile]);

  const matching = useMemo(() => {
    const value = query.trim().toLowerCase();
    return new Set(
      value ? allFiles.filter((file) => file.toLowerCase().includes(value)) : allFiles,
    );
  }, [allFiles, query]);

  const layout = useMemo(() => {
    const byDirectory = new Map<string, string[]>();
    allFiles.forEach((file) => {
      const directory = directoryName(file);
      byDirectory.set(directory, [...(byDirectory.get(directory) || []), file]);
    });

    const directories = [...byDirectory.keys()].sort();
    const columns = Math.min(4, Math.max(1, directories.length));
    const cardWidth = 210;
    const cardHeight = 64;
    const columnGap = 54;
    const rowGap = 32;
    const groupGap = 70;
    const groupWidth = cardWidth + columnGap;
    const positions: PositionedFile[] = [];
    let rowBase = 42;

    for (let start = 0; start < directories.length; start += columns) {
      const batch = directories.slice(start, start + columns);
      const maxRows = Math.max(
        1,
        ...batch.map((directory) => byDirectory.get(directory)?.length || 0),
      );

      batch.forEach((directory, columnIndex) => {
        const items = (byDirectory.get(directory) || []).sort();
        items.forEach((file, rowIndex) => {
          positions.push({
            file,
            directory,
            x: 42 + columnIndex * groupWidth,
            y: rowBase + 42 + rowIndex * (cardHeight + rowGap),
          });
        });
      });

      rowBase += 42 + maxRows * (cardHeight + rowGap) + groupGap;
    }

    return {
      positions,
      directories,
      width: Math.max(940, columns * groupWidth + 84),
      height: Math.max(520, rowBase + 24),
      cardWidth,
      cardHeight,
    };
  }, [allFiles]);

  const positionMap = useMemo(
    () => new Map(layout.positions.map((position) => [position.file, position])),
    [layout.positions],
  );

  if (!allFiles.length) {
    return <div className="graph-empty">No repository files were indexed.</div>;
  }

  return (
    <div className="graph-shell graph-shell-v2">
      <div className="graph-toolbar">
        <Network size={16} />
        <strong>
          {allFiles.length} FILES · {realDependencies.length} REAL IMPORT LINKS · {layout.directories.length} FOLDERS
        </strong>
        <div className="graph-search">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find any file in repository..."
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
        {selectedFile && (
          <button className="graph-clear" onClick={() => setSelectedFile(null)}>
            CLEAR FOCUS
          </button>
        )}
      </div>

      <div className="topology-scroll">
        <div
          className="topology-canvas"
          style={{ width: layout.width, height: layout.height }}
          onClick={() => setSelectedFile(null)}
        >
          <svg
            className="topology-lines"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="cf-edge" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#31516a" />
                <stop offset="100%" stopColor="#5cbcff" />
              </linearGradient>
            </defs>
            {realDependencies.map((edge, index) => {
              const source = positionMap.get(edge.sourceFile);
              const target = positionMap.get(edge.targetFile);
              if (!source || !target) return null;

              const active =
                !selectedFile ||
                edge.sourceFile === selectedFile ||
                edge.targetFile === selectedFile;
              const x1 = source.x + layout.cardWidth;
              const y1 = source.y + layout.cardHeight / 2;
              const x2 = target.x;
              const y2 = target.y + layout.cardHeight / 2;
              const mid = (x1 + x2) / 2;

              return (
                <path
                  key={`${edge.sourceFile}-${edge.targetFile}-${index}`}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={active ? "url(#cf-edge)" : "#22333f"}
                  strokeWidth={active ? 1.8 : 1}
                  opacity={active ? 0.94 : 0.18}
                  className={active ? "topology-edge active" : "topology-edge"}
                />
              );
            })}
          </svg>

          {layout.directories.map((directory, directoryIndex) => {
            const first = layout.positions.find((item) => item.directory === directory);
            if (!first) return null;
            return (
              <div
                className="topology-folder-label"
                key={directory}
                style={{ left: first.x, top: first.y - 28 }}
              >
                <span>{String(directoryIndex + 1).padStart(2, "0")}</span>
                {directory}
              </div>
            );
          })}

          {layout.positions.map((position) => {
            const active = !selectedFile || connected.has(position.file);
            const match = matching.has(position.file);
            const selected = selectedFile === position.file;

            return (
              <button
                key={position.file}
                type="button"
                className={`topology-node${selected ? " selected" : ""}${
                  !active || !match ? " muted" : ""
                }`}
                style={{ left: position.x, top: position.y }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedFile(selected ? null : position.file);
                }}
                title={position.file}
              >
                <span className="topology-node-dot" />
                <span className="topology-node-copy">
                  <strong>{shortName(position.file)}</strong>
                  <small>{position.directory}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="topology-legend">
        <span><i className="legend-file" /> Indexed file</span>
        <span><i className="legend-edge" /> Real import relationship</span>
        <span>Click a file to isolate its direct dependency radius</span>
      </div>
    </div>
  );
}
