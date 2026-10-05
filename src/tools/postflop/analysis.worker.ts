import { analyzeRanges } from '../../core/postflop/analysis';
import type { AnalysisJob, WorkerReply } from './workerProtocol';

// Runs range analyses off the main thread so the screen stays responsive; reports progress
// about every 2% of the 1176 turn+river runouts.

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AnalysisJob>) => void) | null;
  postMessage: (reply: WorkerReply) => void;
};

scope.onmessage = (event) => {
  const job = event.data;
  const started = performance.now();
  try {
    let last = 0;
    const result = analyzeRanges(job.flop, job.hero, job.villains, (done, total) => {
      if (done - last >= total / 50 || done === total) {
        last = done;
        scope.postMessage({ id: job.id, type: 'progress', done, total });
      }
    });
    scope.postMessage({ id: job.id, type: 'done', result, ms: performance.now() - started });
  } catch (e) {
    scope.postMessage({ id: job.id, type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
