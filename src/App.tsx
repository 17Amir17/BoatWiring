import { useState } from 'react';
import Canvas from './canvas/Canvas';
import Palette from './panels/Palette';
import Inspector from './panels/Inspector';
import GaugeStrip from './panels/GaugeStrip';
import ScenarioPanel from './panels/ScenarioPanel';
import ComponentEditor from './panels/ComponentEditor';
import ComponentSandbox from './panels/ComponentSandbox';
import BillOfMaterials from './panels/BillOfMaterials';
import { useSimLoop } from './state/useSimLoop';
import { usePersistence } from './state/usePersistence';
import { useAppStore } from './state/store';

export default function App() {
  useSimLoop();
  usePersistence();
  const sel = useAppStore((s) => s.selection);
  const nodes = useAppStore((s) => s.nodes);

  const [editorOpen, setEditorOpen] = useState<{ defId?: string } | null>(null);
  const [sandboxOpen, setSandboxOpen] = useState<string | null>(null);
  const [showBom, setShowBom] = useState(false);

  const selectedDefId =
    sel.nodeIds.length === 1
      ? nodes.find((n) => n.id === sel.nodeIds[0])?.data.defId
      : undefined;

  return (
    <div className="h-screen w-screen flex flex-col">
      <ScenarioPanel />
      <div className="flex items-center gap-2 px-4 h-9 bg-panel-bg border-b border-panel-border text-xs">
        <button
          className="px-2 py-0.5 rounded bg-panel-hover hover:bg-slate-700/40"
          onClick={() => setEditorOpen({ defId: undefined })}
        >+ new component</button>
        {selectedDefId && (
          <>
            <button
              className="px-2 py-0.5 rounded bg-panel-hover hover:bg-slate-700/40"
              onClick={() => setEditorOpen({ defId: selectedDefId })}
            >edit def</button>
            <button
              className="px-2 py-0.5 rounded bg-panel-hover hover:bg-slate-700/40"
              onClick={() => setSandboxOpen(selectedDefId)}
            >sandbox</button>
          </>
        )}
        <button
          className="ml-auto px-2 py-0.5 rounded bg-panel-hover hover:bg-slate-700/40"
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
