import { useEffect, useState } from 'react';
import Canvas from './canvas/Canvas';
import Palette from './panels/Palette';
import Inspector from './panels/Inspector';
import GaugeStrip from './panels/GaugeStrip';
import ScenarioPanel from './panels/ScenarioPanel';
import ComponentEditor from './panels/ComponentEditor';
import ComponentSandbox from './panels/ComponentSandbox';
import BillOfMaterials from './panels/BillOfMaterials';
import ComponentViewer from './panels/ComponentViewer';
import { useSimLoop } from './state/useSimLoop';
import { usePersistence } from './state/usePersistence';
import { useAppStore } from './state/store';
import { BOAT_DEMO_NODES, BOAT_DEMO_EDGES } from './lib/demos/boatDemo';

function readViewParam(): string | null {
  const p = new URLSearchParams(window.location.search);
  return p.get('view');
}

export default function App() {
  useSimLoop();
  usePersistence();
  const sel = useAppStore((s) => s.selection);
  const nodes = useAppStore((s) => s.nodes);

  const [editorOpen, setEditorOpen] = useState<{ defId?: string } | null>(null);
  const [sandboxOpen, setSandboxOpen] = useState<string | null>(null);
  const [showBom, setShowBom] = useState(false);
  const [viewerDefId, setViewerDefId] = useState<string | null>(() => readViewParam());

  useEffect(() => {
    const onPop = () => setViewerDefId(readViewParam());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const closeViewer = () => {
    setViewerDefId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
  };

  if (viewerDefId) {
    return <ComponentViewer defId={viewerDefId} onClose={closeViewer} />;
  }

  const selectedDefId =
    sel.nodeIds.length === 1
      ? nodes.find((n) => n.id === sel.nodeIds[0])?.data.defId
      : undefined;

  const openViewer = (id: string) => {
    setViewerDefId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('view', id);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <ScenarioPanel />
      <div className="flex items-center gap-2 px-4 h-9 bg-panel-bg border-b border-panel-border text-xs">
        <button
          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
          onClick={() => setEditorOpen({ defId: undefined })}
        >+ new component</button>
        {selectedDefId && (
          <>
            <button
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
              onClick={() => setEditorOpen({ defId: selectedDefId })}
            >edit def</button>
            <button
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
              onClick={() => setSandboxOpen(selectedDefId)}
            >sandbox</button>
            <button
              className="px-2 py-0.5 rounded bg-yellow-200 hover:bg-yellow-300 text-yellow-900"
              onClick={() => openViewer(selectedDefId)}
            >view (large)</button>
          </>
        )}
        <button
          className="ml-auto px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
          onClick={() => {
            // React Flow's controlled-mode edge renderer only draws edges to nodes
            // that exist in its INTERNAL nodeLookup — which it populates from its
            // own state mutations, not from external Zustand setState. So we go
            // through the React Flow instance's setNodes/setEdges, which feed
            // through RF's reconciler. Then we mirror to the Zustand store so the
            // rest of the app (Inspector, simulator, persistence) sees the data.
            const defs = useAppStore.getState().componentDefs;
            const nodes = BOAT_DEMO_NODES.map((n) => {
              const def = defs.get(n.data.defId);
              const size = def?.size ?? { w: 100, h: 60 };
              return {
                ...n,
                measured: { width: size.w, height: size.h },
                width: size.w,
                height: size.h,
              };
            });
            const edges = [...BOAT_DEMO_EDGES];
            const rf = (window as unknown as { rf?: { setNodes: (n: unknown) => void; setEdges: (e: unknown) => void; updateNodeInternals: (id: string) => void } }).rf;
            if (rf) {
              // Stage 1: push nodes through RF only. DON'T mirror to the Zustand
              // store yet — that triggers Canvas to re-render with the controlled
              // `nodes` prop, which makes RF reconcile and lose its handle bounds.
              rf.setNodes(nodes);
              // Stage 2 (after 600 ms): handles have mounted + RF's internal
              // ResizeObserver has populated handleBounds for every node. Now
              // push edges. THEN mirror both to the Zustand store atomically so
              // the rest of the app sees them.
              setTimeout(() => {
                rf.setEdges(edges);
                useAppStore.setState({ nodes, edges });
              }, 600);
            } else {
              useAppStore.setState({ nodes, edges });
            }
          }}
          title="Load the schematic from sketch.txt"
        >load boat demo</button>
        <button
          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
          onClick={() => setShowBom((v) => !v)}
        >{showBom ? 'hide BOM' : 'show BOM'}</button>
      </div>
      <GaugeStrip />
      <div className="flex flex-1 min-h-0">
        <Palette />
        <div className="flex-1 min-w-0">
          <Canvas />
        </div>
        {showBom ? (
          <div className="w-72 h-full overflow-y-auto bg-panel-bg border-l border-panel-border">
            <BillOfMaterials />
          </div>
        ) : (
          <Inspector />
        )}
      </div>
      {editorOpen && (
        <ComponentEditor defId={editorOpen.defId} onClose={() => setEditorOpen(null)} />
      )}
      {sandboxOpen && (
        <ComponentSandbox defId={sandboxOpen} onClose={() => setSandboxOpen(null)} />
      )}
    </div>
  );
}
