// Counterexample search: maximise min(occlusion depth of a target body part, free-arm clearance from the
// 2.6.5 volume) over a box of realistic pose parameters, with realism violations as penalties.
// Random sampling followed by (1+1)-ES hill climbing from the best samples. Deterministic (seeded).
import { frames, type Pose } from './body';
import { clamp, rng, type V3 } from './geom';
import { evaluate, PRESETS, type Eval, type Settings, type Target } from './serve';

export type Key = Exclude<keyof Pose, 'preset'>;
export type Ranges = Record<Key, [number, number]>;

/** Typical serving ranges for a right-handed server (all serve types). The main experiments use these. */
export const TYPICAL: Ranges = {
  px: [-1.1, 0.9], py: [-2.0, -1.4], hipH: [0.8, 0.92],
  yaw: [-105, 60], lean: [5, 45], sideLean: [-10, 10], twist: [-30, 30],
  headFlex: [0, 45], headLat: [-20, 20],
  fhX: [-0.55, 0.3], fhY: [-0.4, 0.45], fhZ: [-0.6, 0], freeSwivel: [-20, 90],
  racketAz: [-180, 180], racketEl: [-40, 60], racketRoll: [-180, 180], racketSwivel: [-20, 110],
  relFwd: [0.25, 0.65], relLat: [-0.35, 0.35], relZ: [0.85, 1.15],
  backToss: [0, 0.3], tossAz: [-30, 30], apex: [0.3, 0.3], contactZ: [0.8, 1.1],
};
/** Extended ranges: near the limits of normal joint motion / unusually high contact. Sensitivity runs only. */
export const EXTENDED: Ranges = {
  ...TYPICAL, hipH: [0.78, 0.95], yaw: [-110, 70], lean: [0, 50], sideLean: [-20, 20], twist: [-35, 35],
  headFlex: [-10, 55], headLat: [-35, 35], fhX: [-0.55, 0.35], fhY: [-0.4, 0.55], fhZ: [-0.6, 0.25], freeSwivel: [-30, 110], relFwd: [0.25, 0.7], relLat: [-0.4, 0.4], relZ: [0.82, 1.25],
  backToss: [0, 0.4], tossAz: [-45, 45], contactZ: [0.8, 1.4],
};

/** Stricter envelope for common low serves: contact ≤ 1.00 m, trunk lean ≤ 35°, neck flexion ≤ 35°. */
export const COMMON: Ranges = { ...TYPICAL, contactZ: [0.8, 1.0], lean: [5, 35], headFlex: [0, 35] };
export const ENVELOPES = { typical: TYPICAL, common: COMMON, extended: EXTENDED };
export type Envelope = keyof typeof ENVELOPES;

/** A serve "family": the preset's stance/toss ± these widths; head, free arm and racket stay fully free. */
const WIDTH: Partial<Record<Key, number>> = {
  px: 0.25, py: 0.15, hipH: 0.06, yaw: 20, lean: 15, sideLean: 15, twist: 25, relFwd: 0.12, relLat: 0.12, relZ: 0.12, tossAz: 30, contactZ: 0.15,
};
export function family(base: Pose, backToss = base.backToss, within: Ranges = TYPICAL): Ranges {
  const r = { ...within };
  for (const k of Object.keys(WIDTH) as Key[]) r[k] = [Math.max(within[k][0], base[k] - WIDTH[k]!), Math.min(within[k][1], base[k] + WIDTH[k]!)];
  r.backToss = [backToss, backToss];
  return r;
}

/** Where serves are struck in practice (typical/common runs only): in front of the hips in the body's facing direction,
 *  within −0.45…+0.55 m sideways, inside the table-width extension ±0.95 m, at most 0.63 m behind the end line. */
export const ZONE = { fwd: [0.15, 0.7], lat: [-0.45, 0.55], absX: 0.95, minY: -2.0 };
export function zoneMiss(p: Pose, C: V3): number {
  const { yawF } = frames(p), dx = C[0] - p.px, dy = C[1] - p.py, pos = (x: number) => Math.max(0, x);
  const cf = dx * yawF[1][0] + dy * yawF[1][1], cl = dx * yawF[0][0] + dy * yawF[0][1];
  return pos(ZONE.fwd[0] - cf) + pos(cf - ZONE.fwd[1]) + pos(ZONE.lat[0] - cl) + pos(cl - ZONE.lat[1]) + pos(Math.abs(C[0]) - ZONE.absX) + pos(ZONE.minY - C[1]);
}

/** margin = min(obstruction depth, free-arm clearance[, Δ]) if every realism constraint holds (1 mm tolerance),
 *  otherwise −(constraint violation). found ⇔ margin > 0. */
export interface Found { target: Target; found: boolean; margin: number; occ: number; clr: number; score: number; pose: Pose; evals: number }
export interface SearchOpts { seed: number; init: number; starts: number; iters: number }
export const DEFAULT_OPTS: SearchOpts = { seed: 7, init: 3000, starts: 16, iters: 500 };

/** `zone`: apply the typical contact zone + free-wrist-below-shoulder realism. `seeds`: poses found by earlier searches;
 *  they join the start pool (clamped into `ranges`), so a pose that satisfies a stricter variant is never missed by a
 *  looser one. `behind`: also require hypothesis B (Δ > 0). `fromS`: require the free arm to be outside the volume over
 *  the whole toss from timeline fraction `fromS` on (sampled at 10 frames), not only at contact. */
export interface SearchOptions {
  budget?: SearchOpts; zone?: boolean; seeds?: Pose[]; behind?: boolean; fromS?: number;
  extra?: (p: Pose, e: Eval) => number; // additional realism penalty (≥ 0) for special-purpose searches
}
export function search(base: Pose, ranges: Ranges, target: Target, st: Settings, opts: SearchOptions = {}): Found {
  const o = opts.budget ?? DEFAULT_OPTS, zone = opts.zone ?? ranges !== EXTENDED, seeds = opts.seeds ?? [], behind = !!opts.behind, { fromS, extra } = opts;
  const keys = (Object.keys(ranges) as Key[]).filter((k) => ranges[k][1] > ranges[k][0]);
  const R = rng(o.seed);
  const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
  const decode = (u: number[]): Pose => {
    const p: Pose = { ...base, preset: base.preset };
    for (const k of Object.keys(ranges) as Key[]) if (ranges[k][0] === ranges[k][1]) p[k] = ranges[k][0];
    keys.forEach((k, i) => { p[k] = ranges[k][0] + (ranges[k][1] - ranges[k][0]) * u[i]; });
    return p;
  };
  let evals = 0;
  // typical/common runs also keep the free wrist no higher than the free shoulder (world z): the free arm drops after the toss
  const bad = (p: Pose, e: Eval) => e.penalty + (zone ? zoneMiss(p, e.tz.C) + Math.max(0, e.body.j.freeWrist[2] - e.body.j.freeShoulder[2]) : 0) + (extra ? extra(p, e) : 0);
  const armOverToss = (p: Pose, e: Eval) => {
    if (fromS === undefined) return e.armMin;
    let m = e.armMin;
    for (let i = 0; i < 10; i++) m = Math.min(m, evaluate(p, st, fromS + ((1 - fromS) * i) / 10).armMin);
    return m;
  };
  const score = (p: Pose, e: Eval) => Math.min(e.occ[target], armOverToss(p, e), behind ? e.delta : Infinity);
  const J = (u: number[]) => { evals++; const p = decode(u), e = evaluate(p, st); return score(p, e) - 10 * bad(p, e); };

  const encode = (p: Pose) => keys.map((k) => clamp((p[k] - ranges[k][0]) / (ranges[k][1] - ranges[k][0]), 0, 1));
  const pool = [...seeds.map(encode), ...Array.from({ length: o.init }, () => keys.map(() => R()))].map((u) => ({ u, J: J(u) })).sort((a, b) => b.J - a.J);
  let best = pool[0];
  const pm = Math.max(2 / keys.length, 0.25);
  for (const start of pool.slice(0, o.starts)) {
    let cur = start, sigma = 0.08;
    for (let it = 0; it < o.iters; it++) {
      const u = cur.u.map((x) => (R() < pm ? clamp(x + sigma * gauss(), 0, 1) : x));
      const j = J(u);
      if (j >= cur.J) { cur = { u, J: j }; sigma = Math.min(0.25, sigma * 1.3); } else sigma = Math.max(0.002, sigma * 0.96);
    }
    if (cur.J > best.J) best = cur;
  }
  const pose = decode(best.u), e = evaluate(pose, st), viol = bad(pose, e);
  const margin = viol <= 1e-3 ? score(pose, e) : Math.min(score(pose, e), -viol);
  return { target, found: margin > 0, margin, occ: e.occ[target], clr: e.armMin, score: best.J, pose: { ...pose, preset: `${base.preset}:search-${target}` }, evals };
}

export const CASES: { id: string; target: Target; title: string }[] = [
  { id: 'A', target: 'torso', title: '2.6.5 compliant AND ball hidden by torso' },
  { id: 'B', target: 'shoulder', title: '2.6.5 compliant AND ball hidden by shoulder' },
  { id: 'B1', target: 'shoulderFree', title: '… by the free-side shoulder' },
  { id: 'B2', target: 'shoulderRacket', title: '… by the racket-side shoulder' },
  { id: 'C', target: 'head', title: '2.6.5 compliant AND ball hidden by head' },
  { id: 'D', target: 'racketArm', title: '2.6.5 compliant AND ball hidden by racket arm' },
];
export const SWEEP_D = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
export const SWEEP_TARGETS: Target[] = ['head', 'shoulder', 'torso'];

/** Backward-toss sweep on the hook-serve family: for each drift δ, best attainable result per target. */
export function sweep(st: Settings, o: SearchOpts = DEFAULT_OPTS, onRow?: (r: SweepCell) => void, env: Envelope = 'typical') {
  const base = PRESETS.hookVertical.pose, out: SweepCell[] = [];
  for (const d of SWEEP_D) for (const target of SWEEP_TARGETS) {
    const f = search({ ...base, preset: 'hook', backToss: d }, family(base, d, ENVELOPES[env]), target, st, { budget: o, zone: env !== 'extended' });
    const cell = { d, ...f };
    out.push(cell); onRow?.(cell);
  }
  return out;
}
export type SweepCell = Found & { d: number };

/** Preset comparison: nominal free-arm legality + best attainable obstruction inside each preset's family. */
export function compare(st: Settings, o: SearchOpts = DEFAULT_OPTS, onRow?: (r: CompareRow) => void, env: Envelope = 'typical') {
  return Object.entries(PRESETS).map(([key, { label, pose }]) => {
    const e = evaluate(pose, st);
    const row: CompareRow = { key, label, nominalLegal: e.legal, nominalClr: e.armMin, results: SWEEP_TARGETS.map((t) => search(pose, family(pose, pose.backToss, ENVELOPES[env]), t, st, { budget: o, zone: env !== 'extended' })) };
    onRow?.(row);
    return row;
  });
}
export interface CompareRow { key: string; label: string; nominalLegal: boolean; nominalClr: number; results: Found[] }
