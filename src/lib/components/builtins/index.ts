import type { ComponentDef } from '../../../types';

const modules = import.meta.glob<{ default: ComponentDef }>('./*.json', { eager: true });

export const BUILTIN_DEFS: ComponentDef[] = Object.values(modules).map((m) => m.default);
