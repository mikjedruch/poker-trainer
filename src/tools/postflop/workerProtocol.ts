import type { RangeAnalysis } from '../../core/postflop/analysis';

/** Hero range against villain ranges on a flop; ranges as hand classes ("AKs", "77"). */
export interface AnalysisJob {
  id: number;
  flop: number[];
  hero: string[];
  villains: string[][];
}

export type WorkerReply =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'done'; result: RangeAnalysis; ms: number }
  | { id: number; type: 'error'; message: string };
