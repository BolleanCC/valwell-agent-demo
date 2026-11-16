"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Handle, Position, MarkerType, useReactFlow,
  type Node, type Edge, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodes, edges, edgeVisibleAt, isMainEdge, KIND, type FlowNode } from "@/lib/flow";
import { ActorIcon, LabelLine } from "./ActorIcon";

type StepNodeData = { node: FlowNode; current: boolean; ahead: boolean };

const SIDES = [["t", Position.Top], ["b", Position.Bottom], ["l", Position.Left], ["r", Position.Right]] as const;

function StepNode({ data: { node, current, ahead } }: NodeProps<Node<StepNodeData>>) {
  const { icon, color } = KIND[node.kind];
  return (
    <div
      className="node-reveal w-[250px] cursor-pointer rounded-lg border bg-surface px-4 py-3 transition-[opacity,transform] duration-150 hover:-translate-y-0.5"
      title={current ? undefined : `Go to step ${node.step}`}
      style={{
        opacity: ahead ? 0.4 : 1,
        borderColor: node.main ? color : `color-mix(in srgb, ${color} 50%, transparent)`,
        borderStyle: node.kind === "decision" ? "dashed" : "solid",
        borderWidth: current ? 2 : 1.5,
        background: node.main ? undefined : "var(--color-bg)",
        boxShadow: current ? `0 0 0 4px color-mix(in srgb, ${color} 28%, transparent), 0 10px 30px rgb(0 0 0 / 0.45)` : undefined,
      }}
    >
      <div className="flex items-center justify-between text-[13px] font-medium" style={{ color }}>
        <span className="flex items-center gap-1.5"><ActorIcon actor={icon} /> {node.kind === "decision" ? "Decision" : node.kind === "ai" ? `AI #${node.ai}` : node.kind === "rule" ? "Rule" : "Human"}</span>
        <span className="font-mono text-muted">{node.step}</span>
      </div>
      <div className={`mt-1 text-[15px] leading-snug ${node.main ? "text-ink" : "text-muted"}`}>
        {node.label.split(" · ").map((line) => (
          <div key={line}>
            <LabelLine line={line} />
          </div>
        ))}
      </div>
      {SIDES.map(([id, pos]) => (
        <span key={id}>
          <Handle id={`${id}-s`} type="source" position={pos} className="!opacity-0" isConnectable={false} />
          <Handle id={`${id}-t`} type="target" position={pos} className="!opacity-0" isConnectable={false} />
        </span>
      ))}
    </div>
  );
}

const nodeTypes = { step: StepNode };
const INK = "#f1f1ef";
const MUTED = "#a3a49f";

type CanvasProps = { step: number; maxStep: number; onSelect: (step: number) => void };

function Canvas({ step, maxStep, onSelect }: CanvasProps) {
  const { fitView } = useReactFlow();

  // Everything revealed so far is drawn; steps after the current one are dimmed.
  const rfNodes = useMemo<Node<StepNodeData>[]>(
    () =>
      nodes
        .filter((n) => n.step <= maxStep)
        .map((n) => ({ id: n.id, type: "step", position: { x: n.x, y: n.y }, data: { node: n, current: n.step === step, ahead: n.step > step } })),
    [step, maxStep],
  );

  const visibleEdges = useMemo(() => edges.filter((e) => edgeVisibleAt(e, step)), [step]);
  const drawnEdges = useMemo(() => edges.filter((e) => edgeVisibleAt(e, maxStep)), [maxStep]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      drawnEdges.map((e) => {
        const main = isMainEdge(e);
        const ahead = !edgeVisibleAt(e, step);
        return {
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          sourceHandle: `${e.sh}-s`,
          targetHandle: `${e.th}-t`,
          label: e.label,
          type: "smoothstep",
          className: `edge-reveal ${main ? "main" : ""} ${ahead ? "ahead" : ""}`,
          style: main ? { stroke: INK, strokeWidth: 1.75 } : { stroke: MUTED, strokeWidth: 1.25, strokeDasharray: "5 5" },
          markerEnd: { type: MarkerType.ArrowClosed, color: main ? INK : MUTED, width: 16, height: 16 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        };
      }),
    [drawnEdges, step],
  );

  // Fit to the newest node and its visible neighbours, so the text stays readable.
  // The fit-view control shows the whole flow on demand.
  useEffect(() => {
    const newest = nodes.find((n) => n.step === step)!.id;
    const ids = [newest, ...visibleEdges.flatMap((e) => (e.source === newest ? [e.target] : e.target === newest ? [e.source] : []))];
    const t = setTimeout(() => fitView({ nodes: ids.map((id) => ({ id })), duration: 600, padding: 0.3, maxZoom: 1.1 }), 40);
    return () => clearTimeout(t);
  }, [step, visibleEdges, fitView]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      onNodeClick={(_, n) => onSelect((n.data as StepNodeData).node.step)}
      minZoom={0.3}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgb(241 241 239 / 0.08)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

export default function FlowCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
