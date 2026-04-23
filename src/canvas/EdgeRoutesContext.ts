import { createContext } from 'react';
import type { EdgeRoute } from './router';

/** Per-edge routed SVG paths. Computed by router/index.ts from the current
 *  nodes+edges; consumed by WireEdge. Lives in its own module to break a
 *  Canvas ↔ WireEdge import cycle. */
export const EdgeRoutesContext = createContext<Map<string, EdgeRoute>>(new Map());
