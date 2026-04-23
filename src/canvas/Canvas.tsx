import { useCallback, useMemo, useRef } from 'react';
import {
  Background,
  ConnectionMode,
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
import EdgeOverlay from './EdgeOverlay';
import { routeEdges } from './router';
import { EdgeRoutesContext } from './EdgeRoutesContext';

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

  const componentDefs = useAppStore((s) => s.componentDefs);
  const routes = useMemo(() => {
    const portPos = (nodeId: string, handleId: string | null) => {
      const n = nodes.find((nn) => nn.id === nodeId);
      if (!n || !handleId) return null;
      const def = componentDefs.get(n.data.defId);
      if (!def) return null;
      const port = def.ports.find((p) => p.id === handleId);
      if (!port) return null;
      const w = n.measured?.width ?? n.width ?? def.size.w;
      const h = n.measured?.height ?? n.height ?? def.size.h;
      return { x: n.position.x + port.rel.x * w, y: n.position.y + port.rel.y * h };
    };
    return routeEdges(edges, nodes, portPos);
  }, [edges, nodes, componentDefs]);
  return (
    <div className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <EdgeRoutesContext.Provider value={routes}>
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
            // Expose for programmatic loaders (e.g. "load boat demo") so they can
            // go through React Flow's internal reconciliation instead of just
            // mutating the store and hoping RF picks it up.
            (window as unknown as { rf?: typeof inst }).rf = inst;
          }}
          defaultEdgeOptions={{ type: 'wire' }}
          // Loose connection mode lets target-type handles also act as sources, which
          // is what we want for passthrough ports (fuse, switch, busbar, etc. — pins
          // that conduct in either direction depending on the circuit).
          connectionMode={ConnectionMode.Loose}
          fitView
          proOptions={{ hideAttribution: true }}
          snapToGrid
          snapGrid={[8, 8]}
        >
          <Background gap={16} color="#e2e8f0" />
          <Controls />
          <EdgeOverlay />
        </ReactFlow>
      </EdgeRoutesContext.Provider>
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
