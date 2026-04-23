import { openDB, type IDBPDatabase } from 'idb';

interface BWSchema {
  images: { key: string; value: { ref: string; blob: Blob; mime: string } };
}

const DB_NAME = 'boat-wiring';
const STORE = 'images';
let dbPromise: Promise<IDBPDatabase<BWSchema>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<BWSchema>(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'ref' });
        }
      },
    });
  }
  return dbPromise;
}

export async function putImage(ref: string, blob: Blob, mime = blob.type) {
  const d = await db();
  await d.put(STORE, { ref, blob, mime });
}

export async function getImageBlob(ref: string): Promise<Blob | undefined> {
  const d = await db();
  const rec = await d.get(STORE, ref);
  return rec?.blob;
}

const urlCache = new Map<string, string>();
export async function getImageURL(ref: string): Promise<string | undefined> {
  if (urlCache.has(ref)) return urlCache.get(ref);
  const blob = await getImageBlob(ref);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  return url;
}

export async function deleteImage(ref: string) {
  const d = await db();
  await d.delete(STORE, ref);
  const cached = urlCache.get(ref);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(ref);
  }
}

export async function listImageRefs(): Promise<string[]> {
  const d = await db();
  return (await d.getAllKeys(STORE)) as string[];
}

export async function imageBlobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
