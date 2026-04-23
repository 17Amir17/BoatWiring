import { engineCrank } from './engineCrank';
import { anchorOvernight } from './anchorOvernight';
import { everythingOn } from './everythingOn';
import type { Scenario } from './types';

export const SCENARIOS: Scenario[] = [engineCrank, anchorOvernight, everythingOn];
export type { Scenario } from './types';
