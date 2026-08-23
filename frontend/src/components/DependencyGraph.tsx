import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { Search, Network, X } from "lucide-react";
import { useMemo, useState } from "react";

import "@xyflow/react/dist/style.css";

import type { Dependency } from "../types";

interface Props {
  dependencies: Dependency[];
}

function shortName(filePath: string) {
  const parts = filePath.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1];
}

function directoryName(filePath: string) {
  const normalized = filePath.replaceAll("\\", "/");
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/") || "root";
}

export default function DependencyGraph({ dependencies }: Props) {
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const files = useMemo(
    () =>
      Array.from(
        new Set(
          dependencies.flatMap((dependency) => [
            dependency.sourceFile,
            dependency.targetFile,
          ]),
        ),
      ),
    [dependencies],
  );

  const connected = useMemo(() => {
    if (!selectedFile) return new Set<string>();

    const result = new Set<string>([selectedFile]);

    dependencies.forEach((dependency) => {
      if (dependency.sourceFile === selectedFile) {
        result.add(dependency.targetFile);
      }
      if (dependency.targetFile === selectedFile) {
        result.add(dependency.sourceFile);
      }
    });

    return result;
  }, [dependencies, selectedFile]);

  const matching = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return new Set(files);

    return new Set(
      files.filter((file) => file.toLowerCase().includes(normalized)),
    );
  }, [files, query]);

  const nodes: Node[] = useMemo(() => {
    const columns = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(files.length))));

    return files.map((file, index) => {
      const isSelected = selectedFile === file;
      const isConnected = !selectedFile || connected.has(file);
      const isMatch = matching.has(file);
      const dimmed = !isConnected || !isMatch;

      return {
        id: file,
        position: {
          x: (index % columns) * 215,
          y: Math.floor(index / columns) * 120,
        },
        data: {
          label: (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shortName(file)}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 7,
                  color: "#61788b",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {directoryName(file)}
              </div>
            </div>
          ),
        },
        style: {
          background: isSelected ? "#102638" : "#0b131d",
          border: isSelected
            ? "1px solid #62b9e6"
            : isConnected && isMatch
              ? "1px solid #28455a"
              : "1px solid #172631",
          color: "#dce8f7",
          borderRadius: 6,
          fontSize: 11,
          width: 178,
          padding: 10,
          opacity: dimmed ? 0.18 : 1,
          boxShadow: isSelected ? "0 0 28px rgba(80, 170, 220, .18)" : "none",
          transition: "all .18s ease",
        },
      };
    });
  }, [files, selectedFile, connected, matching]);

  const edges: Edge[] = useMemo(
    () =>
      dependencies.map((dependency, index) => {
        const touchesSelection =
          !selectedFile ||
          dependency.sourceFile === selectedFile ||
          dependency.targetFile === selectedFile;
        const visibleBySearch =
          matching.has(dependency.sourceFile) && matching.has(dependency.targetFile);

        return {
          id: `${dependency.sourceFile}-${dependency.targetFile}-${index}`,
          source: dependency.sourceFile,
          target: dependency.targetFile,
          animated: Boolean(selectedFile && touchesSelection),
          label: selectedFile && touchesSelection ? dependency.type : undefined,
          style: {
            stroke: selectedFile && touchesSelection ? "#5aa9d2" : "#32495c",
            strokeWidth: selectedFile && touchesSelection ? 1.8 : 1,
            opacity: touchesSelection && visibleBySearch ? 0.9 : 0.08,
          },
          labelStyle: {
            fill: "#7ea7bf",
            fontSize: 7,
          },
        };
      }),
    [dependencies, selectedFile, matching],
  );

  if (!dependencies.length) {
    return (
      <div className="graph-empty">
        No internal dependency relationships were discovered.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          height: 45,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 10px",
          borderBottom: "1px solid #172631",
          background: "#080e14",
        }}
      >
        <Network size={14} color="#5aa9d2" />
        <strong style={{ fontSize: 8, letterSpacing: 1, color: "#8199aa" }}>
          {files.length} FILES · {dependencies.length} RELATIONSHIPS
        </strong>

        <div
          style={{
            marginLeft: "auto",
            width: 280,
            height: 29,
            border: "1px solid #243846",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 8px",
            background: "#060b10",
          }}
        >
          <Search size={12} color="#526b7c" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any file..."
            style={{
              minWidth: 0,
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              color: "#c5d2dc",
              fontSize: 8,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ border: 0, background: "transparent", color: "#657d8d" }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {selectedFile && (
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            style={{
              height: 29,
              border: "1px solid #244055",
              borderRadius: 4,
              background: "#0b1720",
              color: "#88a9bd",
              padding: "0 9px",
              fontSize: 7,
            }}
          >
            CLEAR FOCUS
          </button>
        )}
      </div>

      <div className="dependency-canvas" style={{ height: 560 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.08}
          maxZoom={2.5}
          onNodeClick={(_, node) => setSelectedFile(node.id)}
          onPaneClick={() => setSelectedFile(null)}
          nodesDraggable
          panOnDrag
          zoomOnScroll
        >
          <Background gap={22} size={1} color="#142532" />
          <Controls />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) =>
              node.id === selectedFile ? "#5aa9d2" : "#263f50"
            }
            maskColor="rgba(4, 8, 12, .72)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
