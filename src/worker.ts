// Runs the heavy searches off the UI thread.
import type { Pose } from './body';
import { CASES, compare, ENVELOPES, family, search, sweep, type Envelope } from './search';
import type { Settings } from './serve';

type Job = { kind: 'search' | 'sweep' | 'compare'; st: Settings; pose: Pose; scope: Envelope | 'family'; behind: boolean; whole: boolean };

self.onmessage = (ev: MessageEvent<Job>) => {
  const { kind, st, pose, scope, behind, whole } = ev.data;
  const env: Envelope = scope === 'family' ? 'typical' : scope;
  const progress = (text: string) => postMessage({ kind: 'progress', text });
  if (kind === 'search') {
    const ranges = scope === 'family' ? family(pose) : ENVELOPES[env];
    // whole toss: free arm must stay out of the volume from 10 % of the flight on (≈ 50 ms reaction), 10 frames per candidate
    const o = whole ? { seed: 5, init: 1500, starts: 10, iters: 400 } : undefined;
    const out = CASES.map((c) => { progress(`Case ${c.id}: ${c.target}…`); return { ...c, ...search(pose, ranges, c.target, st, { budget: o, zone: env !== 'extended', behind, fromS: whole ? 0.1 : undefined }) }; });
    postMessage({ kind, out, scope, behind, whole });
  } else if (kind === 'sweep') {
    postMessage({ kind, scope: env, out: sweep(st, undefined, (r) => progress(`δ = ${(r.d * 100).toFixed(0)} cm · ${r.target} done`), env) });
  } else {
    postMessage({ kind, scope: env, out: compare(st, undefined, (r) => progress(`${r.label} done`), env) });
  }
};
