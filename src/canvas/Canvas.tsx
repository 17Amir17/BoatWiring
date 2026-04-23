import { useCallback, useRef } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useAppStore, type BoatNode, type BoatEdge } from '../state/store';
import ComponentNode from './ComponentNode';
import WireEdge from './WireEdge';

const nodeTypes = { component: ComponentNode };
const edgeTypes = { wire: WireEdge };

function CanvasInner() {
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const onNodesChange = useAppStore((s) => s.onNodesChange);
  const onEdgesChange = useAppStore((s) => s.onEdgesChange);
  const onConnect = useAppStore((s) => s.onConnect);
  const addComponent = useAppStore((s) => s.addComponent);
  const rfRef = useRef<ReactFlowInstance<BoatNode, BoatEdge> | null>(null);
  // React Flow re-fires onSelectionChange on every internal update. Read the
  // current selection from the store directly to compare and avoid a loop.
  const onSelectionChange = useCallback((p: OnSelectionChangeParams) => {
    const nodeIds = p.nodes.map((n) => n.id);
    const edgeIds = p.edges.map((e) => e.id);
    const cur = useAppStore.getState().selection;
    if (sameIds(cur.nodeIds, nodeIds) && sameIds(cur.edgeIds, edgeIds)) return;
    useAppStore.getState().setSelection({ nodeIds, edgeIds });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const defId = e.dataTransfer.getData('application/x-defid');
      if (!defId || !rfRef.current) return;
      const position = rfRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addComponent(defId, position);
    },
    [addComponent],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleConnect = useCallback(
    (conn: Connection) => onConnect(conn),
    [onConnect],
  );

  return (
    <div className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={onSelectionChange}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        defaultEdgeOptions={{ type: 'wire' }}
        fitView
        proOptions={{ hideAttribution: true }}
        snapToGrid
        snapGrid={[8, 8]}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
