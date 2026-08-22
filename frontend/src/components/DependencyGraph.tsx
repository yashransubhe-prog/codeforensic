import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type { Dependency } from "../types";

interface Props {
  dependencies: Dependency[];
}

function shortName(path: string) {
  const parts = path.replaceAll("\\", "/").split("/");
  return parts[parts.length - 1];
}

export default function DependencyGraph({
  dependencies,
}: Props) {
  const files = Array.from(
    new Set(
      dependencies.flatMap((dependency) => [
        dependency.sourceFile,
        dependency.targetFile,
      ])
    )
  );

  const nodes: Node[] = files.map((file, index) => ({
    id: file,
    position: {
      x: (index % 5) * 220,
      y: Math.floor(index / 5) * 130,
    },
    data: {
      label: shortName(file),
    },
    style: {
      background: "#0d1522",
      border: "1px solid #263750",
      color: "#dce8f7",
      borderRadius: 8,
      fontSize: 11,
      width: 180,
      padding: 10,
    },
  }));

  const edges: Edge[] = dependencies.map(
    (dependency, index) => ({
      id: `${dependency.sourceFile}-${dependency.targetFile}-${index}`,
      source: dependency.sourceFile,
      target: dependency.targetFile,
      animated: false,
      label: dependency.type,
      style: {
        stroke: "#50698e",
      },
      labelStyle: {
        fill: "#71849d",
        fontSize: 8,
      },
    })
  );

  if (!dependencies.length) {
    return (
      <div className="graph-empty">
        No internal dependency relationships were discovered.
      </div>
    );
  }

  return (
    <div className="dependency-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.15}
        maxZoom={2}
      >
        <Background gap={25} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}