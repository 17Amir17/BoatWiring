import type { ComponentDef } from '../../types';
import type { BoatNode, BoatEdge } from '../../state/store';
import {
  base64ToBlob,
  getImageBlob,
  imageBlobToBase64,
  putImage,
} from './images';

const KEY = 'boat-wiring/schematic/v1';

export interface PersistedSchematic {
  version: 1;
  customDefs: ComponentDef[];
  nodes: BoatNode[];
  edges: BoatEdge[];
  defaultWireDefId: string;
  defaultWireLengthFt: number;
}

export interface ExportBundle extends PersistedSchematic {
  /** ref → { mime, base64 } */
  images: Record<string, { mime: string; b64: string }>;
}

export function saveLocal(schematic: PersistedSchematic) {
  localStorage.setItem(KEY, JSON.stringify(schematic));
}

export function loadLocal(): PersistedSchematic | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedSchematic;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocal() {
  localStorage.removeItem(KEY);
}

export async function exportBundle(s: PersistedSchematic): Promise<ExportBundle> {
  const images: ExportBundle['images'] = {};
  for (const def of s.customDefs) {
    if (!def.imageRef || def.imageRef.startsWith('/')) continue; // /-prefixed = public path
    const blob = await getImageBlob(def.imageRef);
    if (!blob) continue;
    images[def.imageRef] = { mime: blob.type, b64: await imageBlobToBase64(blob) };
  }
  return { ...s, images };
}

export async function importBundle(bundle: ExportBundle): Promise<PersistedSchematic> {
  for (const [ref, { mime, b64 }] of Object.entries(bundle.images ?? {})) {
    const blob = base64ToBlob(b64, mime);
    await putImage(ref, blob, mime);
  }
  const { images: _images, ...rest } = bundle;
  void _images;
  return rest;
}
