// Headless experiment runner: `npm run experiments` → results/experiments.json + results/summary.md
// Same code paths as the web UI (no Three.js). Deterministic: every search is seeded.
import { mkdirSync, writeFileSync } from 'node:fs';
import { frames, type Pose } from '../src/body';
import { TABLE_W } from '../src/geom';
import { CASES, COMMON, DEFAULT_OPTS, EXTENDED, family, search, SWEEP_D, SWEEP_TARGETS, TYPICAL, ZONE, zoneMiss, type Found, type Ranges, type SearchOpts } from '../src/search';
import { DEFAULT_SETTINGS, evaluate, PRESETS, scanTimeline, type Eval, type Settings, type Target } from '../src/serve';

const t0 = Date.now();
const md: string[] = [];
const json: Record<string, unknown> = {};
const cm = (m: number) => `${m >= 0 ? '+' : ''}${(m * 100).toFixed(1)}`;
let quiet = false; // warm-up pass: fill the pose archive, print nothing
const log = (s = '') => { if (quiet) { if (s.startsWith('\n## ') || s.startsWith('## ')) console.error('[warm-up]' + s.trim()); return; } md.push(s); console.log(s); };

/** Search; if nothing is found, retry with three more seeds and a 3× budget before reporting "none".
 *  Every search also starts from all poses archived so far for the same target (cross-seeding), so a pose that
 *  satisfies one variant is re-tested under every later, looser variant. */
const HARD: SearchOpts = { seed: 0, init: 6000, starts: 30, iters: 800 };
const archive: Partial<Record<Target, Pose[]>> = {};
function robust(base: Pose, R: Ranges, target: Target, st: Settings = DEFAULT_SETTINGS, zone?: boolean, behind = false): Found & { tries: number } {
  const seeds = archive[target] ?? (archive[target] = []);
  let best = search(base, R, target, st, { budget: DEFAULT_OPTS, zone, seeds, behind }), evals = best.evals, tries = 1;
  for (const seed of quiet ? [] : [11, 23, 37]) {
    if (best.found) break;
    const f = search(base, R, target, st, { budget: { ...HARD, seed }, zone, seeds, behind });
    evals += f.evals; tries++;
    if (f.margin > best.margin) best = f;
  }
  seeds.push(best.pose);
  if (seeds.length > 60) seeds.shift();
  return { ...best, evals, tries };
}
/** FOUND = counterexample with ≥ 1 cm on both margins; "marginal" = 0–1 cm, i.e. within modelling resolution. */
const cell = (f: Found) => (f.found ? (f.margin >= 0.01 ? `**FOUND** ${cm(f.margin)}` : `marginal ${cm(f.margin)}`) : `none (${cm(f.margin)})`);
const poseOf = (f: Found) => {
  const e = evaluate(f.pose, DEFAULT_SETTINGS);
  return `yaw ${f.pose.yaw.toFixed(0)}°, lean ${f.pose.lean.toFixed(0)}°, side ${f.pose.sideLean.toFixed(0)}°, twist ${f.pose.twist.toFixed(0)}°, neck flex ${f.pose.headFlex.toFixed(0)}°, neck lat ${f.pose.headLat.toFixed(0)}°, contact (${e.ball.map((x) => x.toFixed(2)).join(', ')}) m, δ ${(f.pose.backToss * 100).toFixed(0)} cm`;
};
function poseJSON(p: Pose, st: Settings = DEFAULT_SETTINGS) {
  const e = evaluate(p, st), j = e.body.j, r = (v: number[]) => v.map((x) => Math.round(x * 1e4) / 1e4);
  const eye = (i: number) => (e.eyes[i].hits.length ? `BLOCKED BY ${e.eyes[i].hits[0].part.label}` : e.eyes[i].net ? 'BLOCKED BY NET' : 'VISIBLE');
  return {
    preset: p.preset, serverPosition: [p.px, p.py, p.hipH].map((x) => Math.round(x * 1e4) / 1e4), ball: r(e.ball), releasePoint: r(e.tz.R),
    freeHand: r(j.freeHand), freeElbow: r(j.freeElbow), freeShoulder: r(j.freeShoulder), head: r(j.head),
    torsoYaw: +p.yaw.toFixed(2), torsoLean: +p.lean.toFixed(2), headLean: +p.headFlex.toFixed(2), headLateral: +p.headLat.toFixed(2),
    backwardToss: +p.backToss.toFixed(4), tossLaunchAngleDeg: +e.tz.launch.toFixed(2),
    leftEyeVisibility: eye(0), rightEyeVisibility: eye(1), hiddenBy: e.hiddenBy,
    freeArmLegal: e.legal, freeArmMinClearance_m: +(e.armMin + st.margin).toFixed(4), deltaBallMinusFreeHand_m: +e.delta.toFixed(4),
    settings: st, params: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
  };
}

// 1. Presets as defined (nominal poses) ----------------------------------------------------------------
log('## 1. Presets (nominal poses, default settings)\n');
log('| preset | ball at contact (m) | toss δ / launch | 2.6.5 free arm (min clearance) | free arm out of volume from | ball hidden at contact | ball hidden during toss | Δ ball−free hand |');
log('|---|---|---|---|---|---|---|---|');
json.presets = Object.entries(PRESETS).map(([key, { label, pose }]) => {
  const e = evaluate(pose, DEFAULT_SETTINGS), sc = scanTimeline(pose, DEFAULT_SETTINGS);
  const hiddenFrames = sc.frames.filter((f) => f.hidden).length;
  log(`| ${label} | (${e.ball.map((x) => x.toFixed(2)).join(', ')}) | ${(pose.backToss * 100).toFixed(0)} cm / ${e.tz.launch.toFixed(1)}° | ${e.legal ? 'LEGAL' : '**ILLEGAL**'} (${cm(e.armMin + DEFAULT_SETTINGS.margin)} cm) | ${sc.exit > 1 ? 'never (in volume at contact)' : `t = ${(sc.exit * 100).toFixed(0)} %`} | ${e.hidden ? 'yes: ' + e.hiddenBy.join('+') : 'no'} | ${hiddenFrames}/${sc.frames.length} frames | ${cm(e.delta)} cm |`);
  return { key, label, legal: e.legal, clearance: e.armMin + DEFAULT_SETTINGS.margin, exit: sc.exit, hidden: e.hidden, hiddenBy: e.hiddenBy, hiddenFrames, delta: e.delta, issues: e.issues };
});

const base = PRESETS.backhand.pose;
const caseRuns: Record<string, Found> = {};
/** Sections 2–7 run twice: a quiet warm-up pass fills the cross-seeding archive, the second pass is reported,
 *  so every table cell has been seeded with every pose found anywhere in the study. */
function sections() {
// 2. Counterexample search, all serve types --------------------------------------------------------------
for (const [id, name, R] of [['2a', 'typical', TYPICAL], ['2b', 'common', COMMON], ['2c', 'extended', EXTENDED]] as const) {
  log(`\n## ${id}. Counterexample search — all serve types, ${name.toUpperCase()} ${name === 'common' ? 'envelope (contact ≤ 1.00 m, lean ≤ 35°, neck flexion ≤ 35°)' : 'ranges'}${name === 'extended' ? ' (no contact-zone constraint)' : ''}\n`);
  log('| case | condition | result: min(obstruction depth, free-arm clearance) cm | obstruction / clearance cm | pose | evaluations |');
  log('|---|---|---|---|---|---|');
  for (const c of CASES) {
    const f = robust(base, R, c.target);
    caseRuns[`${name}:${c.id}`] = f;
    log(`| ${c.id} | ${c.title} | ${cell(f)} | ${cm(f.occ)} / ${cm(f.clr + DEFAULT_SETTINGS.margin)} | ${poseOf(f)} | ${f.evals} (${f.tries} seed${f.tries > 1 ? 's' : ''}) |`);
  }
}
json.cases = Object.fromEntries(Object.entries(caseRuns).map(([k, f]) => [k, { found: f.found, margin: f.margin, occ: f.occ, clr: f.clr, pose: poseJSON(f.pose) }]));

// 2c. The user's exact hypothesis: A (free arm out of V) AND B (contact point behind the free hand, Δ > 0) ------
log('\n## 2d. Hypothesis A + B: free arm outside the volume AND ball behind the free hand (Δ > 0), typical ranges\n');
log('| case | result: min(obstruction, clearance, Δ) cm | obstruction / clearance / Δ cm | pose |');
log('|---|---|---|---|');
json.casesAB = CASES.map((c) => {
  const f = robust(base, TYPICAL, c.target, DEFAULT_SETTINGS, undefined, true), e = evaluate(f.pose, DEFAULT_SETTINGS);
  caseRuns[`AB:${c.id}`] = f;
  log(`| ${c.id} ${c.target} | ${cell(f)} | ${cm(f.occ)} / ${cm(f.clr + DEFAULT_SETTINGS.margin)} / ${cm(e.delta)} | ${poseOf(f)} |`);
  return { id: c.id, target: c.target, found: f.found, margin: f.margin, occ: f.occ, clr: f.clr, delta: e.delta, pose: poseJSON(f.pose) };
});

// 3. Rule-model / criterion sensitivity (typical ranges) ---------------------------------------------------
log('\n## 3. Sensitivity to the rule-model choices (typical ranges)\n');
const variants: [string, Partial<Settings>][] = [
  ['default: both eyes, ball-centre ray, hull floor, net ±0.915, margin 2 cm', {}],
  ['whole ball hidden from both eyes', { wholeBall: true }],
  ['strict 2.6.5 volume: vertical prism above playing surface', { floor: 'prism' }],
  ['either eye blocked', { criterion: 'either' }],
  ['margin 0 (ball as a point)', { margin: 0 }],
  ['net span = table sidelines ±0.7625', { halfSpan: 0.7625 }],
];
const targets3: Target[] = ['head', 'shoulder', 'shoulderFree', 'torso', 'racketArm'];
log(`| variant | ${targets3.join(' | ')} |`);
log(`|---|${targets3.map(() => '---').join('|')}|`);
json.variants = variants.map(([label, v]) => {
  const st = { ...DEFAULT_SETTINGS, ...v };
  const res = targets3.map((t) => robust(base, TYPICAL, t, st));
  log(`| ${label} | ${res.map(cell).join(' | ')} |`);
  return { label, v, res: res.map((f) => ({ target: f.target, found: f.found, margin: f.margin, occ: f.occ, clr: f.clr })) };
});

// 4. Receiver position sensitivity --------------------------------------------------------------------------
log('\n## 4. Receiver lateral position (typical ranges)\n');
log(`| receiver eye x | ${targets3.join(' | ')} |`);
log(`|---|${targets3.map(() => '---').join('|')}|`);
json.receiver = [-0.4, 0, 0.4].map((x) => {
  const st = { ...DEFAULT_SETTINGS, recvX: x };
  const res = targets3.map((t) => robust(base, TYPICAL, t, st));
  log(`| ${x.toFixed(1)} m | ${res.map(cell).join(' | ')} |`);
  return { x, res: res.map((f) => ({ target: f.target, found: f.found, margin: f.margin, occ: f.occ, clr: f.clr })) };
});

// 5. Contact-height requirement ------------------------------------------------------------------------------
log('\n## 5. Highest allowed contact point (typical joints, contact zone on)\n');
const caps = [0.9, 0.95, 1.0, 1.05, 1.1, 1.2];
log(`| target | ${caps.map((z) => `z ≤ ${z.toFixed(2)} m`).join(' | ')} |`);
log(`|---|${caps.map(() => '---').join('|')}|`);
json.contactCap = targets3.map((t) => {
  const res = caps.map((z) => robust(base, { ...TYPICAL, contactZ: [0.8, z], relZ: [0.85, Math.max(1.15, z)] }, t));
  log(`| ${t} | ${res.map(cell).join(' | ')} |`);
  return { target: t, res: res.map((f, i) => ({ zmax: caps[i], found: f.found, margin: f.margin, occ: f.occ, clr: f.clr })) };
});

// 5b/5c. Posture requirement: how much trunk lean / neck flexion is needed ---------------------------------------
log('\n## 5b. Highest allowed trunk lean (typical ranges otherwise)\n');
const leans = [20, 25, 30, 35, 40, 45];
const targets5: Target[] = ['head', 'shoulder', 'torso', 'racketArm'];
log(`| target | ${leans.map((l) => `lean ≤ ${l}°`).join(' | ')} |`);
log(`|---|${leans.map(() => '---').join('|')}|`);
json.leanCap = targets5.map((t) => {
  const res = leans.map((l) => robust(base, { ...TYPICAL, lean: [5, l] }, t));
  log(`| ${t} | ${res.map(cell).join(' | ')} |`);
  return { target: t, res: res.map((f, i) => ({ leanMax: leans[i], found: f.found, margin: f.margin, occ: f.occ, clr: f.clr })) };
});
log('\n## 5c. Highest allowed neck flexion — head target (typical ranges otherwise)\n');
const necks = [15, 25, 35, 45];
log(`| target | ${necks.map((n) => `neck flex ≤ ${n}°`).join(' | ')} |`);
log(`|---|${necks.map(() => '---').join('|')}|`);
const neckRes = necks.map((n) => robust(base, { ...TYPICAL, headFlex: [0, n] }, 'head'));
log(`| head | ${neckRes.map(cell).join(' | ')} |`);
json.neckCap = neckRes.map((f, i) => ({ neckMax: necks[i], found: f.found, margin: f.margin, occ: f.occ, clr: f.clr }));

// 6. Backward-toss sweeps: hook family and all serve types, in the typical and the stricter common envelope ------
const hook = PRESETS.hookVertical.pose;
const D4 = [0, 0.1, 0.2, 0.3];
const sweepTable = (id: string, title: string, ds: number[], run: (d: number, t: Target) => Found) => {
  log(`\n## ${id}. ${title}\n`);
  log(`| target | ${ds.map((d) => `δ = ${(d * 100).toFixed(0)} cm`).join(' | ')} |`);
  log(`|---|${ds.map(() => '---').join('|')}|`);
  const rows = SWEEP_TARGETS.map((t) => {
    const res = ds.map((d) => run(d, t));
    log(`| ${t} | ${res.map(cell).join(' | ')} |`);
    return { target: t, res: res.map((f, i) => ({ d: ds[i], found: f.found, margin: f.margin, occ: f.occ, clr: f.clr, pose: f.pose })) };
  });
  return rows;
};
json.sweep_hook_typical = sweepTable('6a', 'Backward-toss sweep — hook family, TYPICAL envelope', SWEEP_D, (d, t) => robust({ ...hook, preset: 'hook', backToss: d }, family(hook, d, TYPICAL), t));
const angles = SWEEP_D.map((d) => evaluate({ ...hook, backToss: d }, DEFAULT_SETTINGS).tz);
log(`| toss angle (nominal hook toss, rise 30 cm): launch / chord | ${angles.map((a) => `${a.launch.toFixed(1)}° / ${a.chord.toFixed(1)}°`).join(' | ')} |`);
json.sweep_hook_common = sweepTable('6b', 'Backward-toss sweep — hook family, COMMON envelope (contact ≤ 1.00 m, lean ≤ 35°, neck flexion ≤ 35°)', SWEEP_D, (d, t) => robust({ ...hook, preset: 'hook', backToss: d }, family(hook, d, COMMON), t));
json.sweep_all_typical = sweepTable('6c', 'Backward-toss sweep — all serve types, TYPICAL envelope, δ fixed', D4, (d, t) => robust({ ...base, backToss: d }, { ...TYPICAL, backToss: [d, d] }, t));
json.sweep_all_common = sweepTable('6d', 'Backward-toss sweep — all serve types, COMMON envelope, δ fixed', D4, (d, t) => robust({ ...base, backToss: d }, { ...COMMON, backToss: [d, d] }, t));

// 7. Preset comparison (each preset ± family widths) -------------------------------------------------------------
for (const [id, envName, env] of [['7a', 'TYPICAL', TYPICAL], ['7b', 'COMMON', COMMON]] as const) {
  log(`\n## ${id}. Preset comparison — best attainable within each preset family, ${envName} envelope\n`);
  log('| preset | 2.6.5 nominal (clearance) | head | shoulder | torso |');
  log('|---|---|---|---|---|');
  json[`compare_${envName.toLowerCase()}`] = Object.entries(PRESETS).map(([key, { label, pose }]) => {
    const e = evaluate(pose, DEFAULT_SETTINGS);
    const res = SWEEP_TARGETS.map((t) => robust(pose, family(pose, pose.backToss, env), t));
    log(`| ${label} | ${e.legal ? 'LEGAL' : '**ILLEGAL**'} (${cm(e.armMin + DEFAULT_SETTINGS.margin)}) | ${res.map(cell).join(' | ')} |`);
    return { key, nominalLegal: e.legal, res: res.map((f) => ({ target: f.target, found: f.found, margin: f.margin, occ: f.occ, clr: f.clr, pose: f.pose })) };
  });
}
}
quiet = true;
sections();
quiet = false;
sections();

// representative poses
log('\n## 8. Representative counterexample poses (typical ranges)\n');
for (const id of ['C', 'B', 'A', 'D']) {
  const f = caseRuns[`typical:${id}`];
  if (!f.found) continue;
  log(`### Case ${id} (${f.target}) — zone miss ${zoneMiss(f.pose, evaluate(f.pose, DEFAULT_SETTINGS).tz.C).toFixed(3)}\n\n\`\`\`json\n${JSON.stringify(poseJSON(f.pose), null, 1)}\n\`\`\`\n`);
}
// 9. Supplementary (after both passes, so the tables above are unaffected): torso without turning past side-on --
log('\n## 9. Supplementary — stricter stance limits (no turning past side-on: yaw ≥ −90°; optionally ball inside the sidelines)\n');
log('| envelope | torso (yaw ≥ −90°) | torso (yaw ≥ −90°, ball inside the sidelines) | head (yaw ≥ −90°) | shoulder (yaw ≥ −90°) |');
log('|---|---|---|---|---|');
json.stance = (['typical', 'common'] as const).map((name) => {
  const R = { ...(name === 'typical' ? TYPICAL : COMMON), yaw: [-90, 60] as [number, number] };
  const torso = robust(base, R, 'torso');
  ZONE.absX = TABLE_W / 2;
  const torsoIn = robust(base, R, 'torso');
  ZONE.absX = 0.95;
  const head = robust(base, R, 'head'), shoulder = robust(base, R, 'shoulder');
  log(`| ${name} | ${cell(torso)} | ${cell(torsoIn)} | ${cell(head)} | ${cell(shoulder)} |`);
  return { name, torso: poseJSON(torso.pose), torsoInside: poseJSON(torsoIn.pose), head: poseJSON(head.pose), shoulder: poseJSON(shoulder.pose), margins: [torso.margin, torsoIn.margin, head.margin, shoulder.margin] };
});

// 10. Supplementary: traditional pendulum serve struck close to the body (after both passes) -----------------------
log('\n## 10. Supplementary — traditional pendulum serve struck close to the body\n');
log('Side-on stance (pelvis yaw −95…−65°) with the **shoulder line also side-on** (yaw + twist within −100…−60°), trunk lean 15–40°, racket behind the ball swinging right→left, contact 0.15–0.30 m in front of the hips, toss chord ≤ 30°, free arm outside the 2.6.5 volume from 8 % of the toss on, server watches the ball. Target: any body part except the free arm. Three seeds × 30 000-candidate budget each.\n');
log('| variant | result: min(obstruction, whole-toss free-arm clearance) cm | closest occluder (obstruction depth cm) |');
log('|---|---|---|');
const PEND: Ranges = { ...TYPICAL, px: [-1.1, 0.2], yaw: [-95, -65], lean: [15, 40], racketAz: [-120, -45], racketEl: [-10, 45], racketRoll: [-60, 60] };
const pos = (x: number) => Math.max(0, x);
const pendExtra = (sideOn: boolean) => (p: Pose, e: Eval) => {
  const { yawF } = frames(p), cf = (e.tz.C[0] - p.px) * yawF[1][0] + (e.tz.C[1] - p.py) * yawF[1][1];
  return (sideOn ? (pos(-100 - (p.yaw + p.twist)) + pos(p.yaw + p.twist + 60)) * 0.005 : 0) + pos(cf - 0.3) + pos(e.tz.chord - 30) * 0.002;
};
json.pendulum = ([
  ['standard pendulum racket path', PEND, true],
  ['wider racket path (blade more from the side/behind)', { ...PEND, racketAz: [-160, -45], racketEl: [-30, 45], racketRoll: [-100, 100] } as Ranges, true],
  ['for contrast: shoulder line free to turn away (twist ±30° on top of the stance)', { ...PEND, lean: [5, 45] } as Ranges, false],
] as const).map(([label, R, sideOn]) => {
  let best: Found | null = null;
  for (const seed of [5, 23, 41]) {
    const f = search(PRESETS.backhand.pose, R, 'anyBody', DEFAULT_SETTINGS, { budget: { ...HARD, seed }, fromS: 0.08, extra: pendExtra(sideOn), seeds: archive.anyBody ?? [] });
    (archive.anyBody ??= []).push(f.pose);
    if (!best || f.margin > best.margin) best = f;
  }
  const e = evaluate(best!.pose, DEFAULT_SETTINGS), cats = (['head', 'shoulder', 'torso', 'racketArm', 'racket', 'leg'] as const).map((c) => [c, e.occ[c]] as const).sort((a, b) => b[1] - a[1]);
  log(`| ${label} | ${cell(best!)} | ${cats[0][0]} ${cm(cats[0][1])}, ${cats[1][0]} ${cm(cats[1][1])} |`);
  return { label, margin: best!.margin, found: best!.found, closest: cats.slice(0, 2), pose: poseJSON(best!.pose) };
});

log(`\n_Total runtime ${((Date.now() - t0) / 1000).toFixed(0)} s._`);
mkdirSync('results', { recursive: true });
writeFileSync('results/summary.md', md.join('\n') + '\n');
writeFileSync('results/experiments.json', JSON.stringify(json, null, 1));
