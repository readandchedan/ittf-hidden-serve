// Serve presets, toss trajectory, timeline, and the per-frame rule evaluation (2.6.4 visibility + 2.6.5 free arm).
import { buildBody, DIM, frames, racketFrame, releaseWrist, type Body, type Cat, type Part, type Pose } from './body';
import {
  add, BALL_R, clamp, cross, deg, dist, dot, END_Y, lerp, makeVolume, mul, netBlocks, norm, occlusion, pointClearance,
  POST_OUT, rad, sdSegment, sub, TABLE_H, type Floor, type V3, type Volume,
} from './geom';

export interface Settings {
  recvX: number; recvDist: number; eyeH: number; ipd: number; // receiver head: x, distance behind own end line, eye height, eye spacing
  criterion: 'both' | 'either' | 'center'; // experiment parameter — NOT an ITTF definition
  wholeBall: boolean; // hidden = whole 40 mm silhouette covered (9 rays) instead of the ray to the ball centre
  halfSpan: number; floor: Floor; // interpretation of "the net and its indefinite upward extension"
  margin: number; // extra clearance required between free arm and the 2.6.5 volume (default: ball radius)
}
export const DEFAULT_SETTINGS: Settings = {
  recvX: 0, recvDist: 0.55, eyeH: 1.45, ipd: 0.063, criterion: 'both', wholeBall: false, halfSpan: POST_OUT, floor: 'hull', margin: BALL_R,
};

// ---------------------------------------------------------------------------------------------- presets
// Game positions: every preset strikes the ball 5–11 cm behind the end line (A is the default pose).
const BASE: Pose = {
  preset: 'backhand', px: -1.07, py: -1.44, hipH: 0.86, yaw: -80, lean: 28, sideLean: 0, twist: 10, headFlex: 25, headLat: 0,
  fhX: 0.02, fhY: -0.06, fhZ: -0.52, freeSwivel: 10, racketAz: -90, racketEl: 25, racketRoll: 0, racketSwivel: 30,
  relFwd: 0.3, relLat: 0.05, relZ: 0.98, backToss: 0, tossAz: 0, apex: 0.3, contactZ: 0.92,
};
const HOOK: Pose = {
  ...BASE, preset: 'hookVertical', px: -1.0, py: -1.4, hipH: 0.84, yaw: -85, lean: 35, twist: 15, headFlex: 35,
  fhX: 0.08, fhY: -0.12, fhZ: -0.48, racketAz: -90, racketEl: 25, racketRoll: 0, racketSwivel: 90,
  relFwd: 0.48, relLat: 0.1, relZ: 1.0, contactZ: 1.0,
};
export const PRESETS: Record<string, { label: string; pose: Pose }> = {
  backhand: { label: 'Backhand corner / side-on', pose: BASE },
  middle: { label: 'Middle', pose: { ...BASE, preset: 'middle', px: -0.25, py: -1.6, yaw: -45, lean: 25, twist: 5, headFlex: 20, relFwd: 0.3, relLat: 0.05 } },
  forehand: { label: 'Forehand side', pose: { ...BASE, preset: 'forehand', px: 0.3, py: -1.64, yaw: -65, lean: 25, relFwd: 0.45, relLat: 0.0 } },
  hookVertical: { label: 'Hook — vertical toss', pose: HOOK },
  hookBackward: { label: 'Hook — backward toss', pose: { ...HOOK, preset: 'hookBackward', backToss: 0.2 } },
};

// ---------------------------------------------------------------------------------------------- toss
export const GRAV = 9.81;
export type Toss = ReturnType<typeof toss>;
/** Projectile from release point R: rises `apex`, drifts `backToss` horizontally along u, struck at contactZ. */
export function toss(p: Pose) {
  const { yawF } = frames(p), f = yawF[1], r = yawF[0];
  const R: V3 = [p.px + f[0] * p.relFwd + r[0] * p.relLat, p.py + f[1] * p.relFwd + r[1] * p.relLat, p.relZ];
  const a = rad(p.tossAz);
  const u = norm(add(mul(f, -Math.cos(a)), mul(r, Math.sin(a)))); // horizontal, towards the server's body
  const C: V3 = [R[0] + u[0] * p.backToss, R[1] + u[1] * p.backToss, p.contactZ];
  const vz = Math.sqrt(2 * GRAV * p.apex), ta = vz / GRAV, fall = p.relZ + p.apex - p.contactZ;
  const T = ta + Math.sqrt((2 * Math.max(fall, 0)) / GRAV), vh = p.backToss / T;
  const at = (s: number): V3 => { const t = s * T; return [R[0] + u[0] * vh * t, R[1] + u[1] * vh * t, R[2] + vz * t - (GRAV * t * t) / 2]; };
  return {
    R, C, u, T, sApex: ta / T, fall, at,
    launch: deg(Math.atan2(vh, vz)), // initial velocity vs vertical
    chord: deg(Math.atan2(vh * ta, p.apex)), // straight line release → apex vs vertical
  };
}
export function phase(s: number, sApex: number) {
  if (s <= 0.001) return 'release';
  if (s >= 0.999) return 'contact';
  if (Math.abs(s - sApex) < 0.02) return 'apex';
  return s < sApex ? 'rising' : 'falling';
}

// ---------------------------------------------------------------------------------------------- evaluation
export const SERVER_CATS: Cat[] = ['head', 'neck', 'shoulder', 'torso', 'freeArm', 'racketArm', 'racket', 'leg'];
/** Occluder groups that can be reported / searched: every body category plus the two shoulder sides. */
export type Target = Cat | 'shoulderFree' | 'shoulderRacket' | 'anyBody';
export const TARGETS: Record<Target, (q: Part) => boolean> = {
  ...(Object.fromEntries(SERVER_CATS.map((c) => [c, (q: Part) => q.cat === c])) as Record<Cat, (q: Part) => boolean>),
  shoulderFree: (q) => q.name === 'freeShoulder' || q.name === 'freeGirdle',
  shoulderRacket: (q) => q.name === 'racketShoulder' || q.name === 'racketGirdle',
  anyBody: (q) => q.cat !== 'freeArm', // anything of the server except the free arm (which 2.6.5 governs)
};
const TARGET_KEYS = Object.keys(TARGETS) as Target[];
type CatMap = Record<Target, number>;
const catMap = (v: number) => Object.fromEntries(TARGET_KEYS.map((c) => [c, v])) as CatMap;

export function eyes(st: Settings): { name: 'left' | 'right' | 'center'; p: V3 }[] {
  const y = -END_Y + st.recvDist; // receiver faces −Y, so their left eye is at +X
  return [
    { name: 'left', p: [st.recvX + st.ipd / 2, y, st.eyeH] },
    { name: 'right', p: [st.recvX - st.ipd / 2, y, st.eyeH] },
    { name: 'center', p: [st.recvX, y, st.eyeH] },
  ];
}

/** Sight targets: ball centre, plus 8 points just inside the silhouette rim when the whole ball must be hidden. */
function targets(E: V3, ball: V3, whole: boolean): V3[] {
  if (!whole) return [ball];
  const d = norm(sub(ball, E)), a = norm(cross(d, [0, 0, 1])), b = cross(d, a), out = [ball];
  for (let k = 0; k < 8; k++) out.push(add(ball, add(mul(a, 0.98 * BALL_R * Math.cos((k * Math.PI) / 4)), mul(b, 0.98 * BALL_R * Math.sin((k * Math.PI) / 4)))));
  return out;
}

export interface EyeEval { name: string; p: V3; hits: { part: Part; t: number }[]; net: boolean; blocked: number; n: number; anyMin: number }
export interface Eval {
  s: number; phase: string; ball: V3; vol: Volume; body: Body; tz: Toss;
  eyes: EyeEval[];
  occ: CatMap; // per target group, combined over eyes by the criterion: > 0 ⇔ that group hides the ball
  hidden: boolean; hiddenBy: Cat[];
  arm: { part: Part; clr: number; t: number }[]; armMin: number; legal: boolean;
  delta: number; pNet: V3; pNetInside: boolean;
  gaze: { angle: number; blockedBy: string[]; penalty: number }; // server's own view of the ball (from between the eyes)
  issues: string[]; penalty: number;
}

/** Parts that may not stand between the server's eyes and the ball (racket hand/forearm/racket and head excluded). */
const SELF_VIEW = new Set(['torso', 'pelvis', 'freeGirdle', 'racketGirdle', 'freeShoulder', 'racketShoulder', 'freeUpperArm', 'racketUpperArm', 'freeForearm', 'freeHand', 'thighL', 'thighR', 'shinL', 'shinR', 'neck']);
export const GAZE_MAX = 65; // degrees off the face direction the server can still watch the ball

const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, w: number) => a + (b - a) * w;

/** Evaluate the serve at timeline s ∈ [0,1] (0 = release, 1 = contact). `detail` also counts 9 silhouette rays per eye for display. */
export function evaluate(p: Pose, st: Settings, s = 1, detail = false): Eval {
  const tz = toss(p);
  const sc = clamp(s, 0, 1), atContact = sc >= 1;
  const ball = atContact ? tz.C : tz.at(sc);
  // Simplified timeline: trunk winds up (twist −20°, head upright) and unwinds into the contact pose;
  // free wrist leaves the ball over the first 30 % of the flight; racket swings in from 30 cm behind the blade.
  const wb = smooth(0.25, 1, sc);
  const pose: Pose = atContact ? p : { ...p, twist: p.twist - 20 * (1 - wb), headFlex: mix(Math.min(p.headFlex, 10), p.headFlex, wb), headLat: p.headLat * wb, lean: mix(p.lean * 0.85, p.lean, wb) };
  const rn = racketFrame(p, tz.C).n;
  const racketAt = add(tz.C, mul(add(mul(rn, -0.3), [0, 0, 0.06]), 1 - smooth(0.35, 1, sc)));
  const body = buildBody(pose, racketAt, atContact ? undefined : { R: tz.R, w: smooth(0, 0.3, sc) });
  const vol = makeVolume(ball, st.halfSpan, st.floor);

  // Law 2.6.5 — clearance of each free-arm capsule from the volume
  const arm = body.parts.filter((q) => q.cat === 'freeArm').map((part) => {
    const sh = part.shape as Extract<Part['shape'], { kind: 'capsule' }>, r = sdSegment(vol, sh.a, sh.b);
    return { part, clr: r.d - sh.r - st.margin, t: r.t };
  });
  const armMin = Math.min(...arm.map((a) => a.clr));

  // Law 2.6.4 — sight lines from each eye to the ball
  const perEye: CatMap[] = [];
  const eyeEvals: EyeEval[] = eyes(st).map((e) => {
    const occ = catMap(Infinity);
    let anyMin = Infinity;
    for (const T of targets(e.p, ball, st.wholeBall)) {
      const best = catMap(-Infinity);
      for (const part of body.parts) {
        const m = occlusion(part.shape, e.p, T).m;
        for (const t of TARGET_KEYS) if (TARGETS[t](part) && m > best[t]) best[t] = m;
      }
      let any = -Infinity;
      for (const t of TARGET_KEYS) occ[t] = Math.min(occ[t], best[t]);
      for (const c of SERVER_CATS) any = Math.max(any, best[c]);
      anyMin = Math.min(anyMin, any);
    }
    perEye.push(occ);
    const rim = targets(e.p, ball, detail || st.wholeBall);
    const blocked = rim.filter((T) => netBlocks(e.p, T) || body.parts.some((q) => occlusion(q.shape, e.p, T).m > 0)).length;
    const hits = body.parts.map((part) => ({ part, o: occlusion(part.shape, e.p, ball) })).filter((h) => h.o.m > 0)
      .sort((a, b) => a.o.t - b.o.t).map((h) => ({ part: h.part, t: h.o.t }));
    return { name: e.name, p: e.p, hits, net: netBlocks(e.p, ball), blocked, n: rim.length, anyMin };
  });
  const pick = (v: number[]) => (st.criterion === 'both' ? Math.min(v[0], v[1]) : st.criterion === 'either' ? Math.max(v[0], v[1]) : v[2]);
  const occ = Object.fromEntries(TARGET_KEYS.map((c) => [c, pick(perEye.map((o) => o[c]))])) as CatMap;

  // Δ along the receiver's line of sight (centre eye → ball): > 0 ⇒ ball farther from the receiver than the free hand
  const Ec = eyeEvals[2].p, u = norm(sub(ball, Ec));
  const delta = dot(sub(ball, Ec), u) - dot(sub(body.j.freeHand, Ec), u);
  const pNet = lerp(Ec, ball, Ec[1] / (Ec[1] - ball[1]));

  // Realism / legality-of-setup checks (Laws 2.6.2–2.6.4 geometry + plausibility)
  const issues = [...body.issues];
  let penalty = body.penalty;
  const flag = (amt: number, msg: string) => { if (amt > 0) { penalty += amt; issues.push(msg); } };
  flag(tz.C[1] - (END_Y - BALL_R), 'contact point not behind the end line');
  flag(TABLE_H + BALL_R - tz.C[2], 'contact point below the playing surface');
  flag(tz.R[1] - (END_Y - BALL_R), 'release point not behind the end line');
  flag(TABLE_H + BALL_R - tz.R[2], 'release point below the playing surface');
  flag(0.005 - tz.fall, 'ball not falling at contact');
  flag(0.16 - p.apex, 'toss rises < 16 cm');
  const SF = body.j.freeShoulder;
  flag(dist(SF, releaseWrist(SF, tz.R)) - (DIM.upperArm + DIM.forearm), 'release point out of the free hand’s reach');
  if (atContact) for (const part of body.parts) if (part.cat !== 'racket') flag(BALL_R - pointClearance(part.shape, ball), `ball touches ${part.label}`);
  // The server must be able to watch the ball at contact: within GAZE_MAX of the face direction, own body not in the way.
  const head = body.parts.find((q) => q.name === 'head')!.shape as Extract<Part['shape'], { kind: 'ellipsoid' }>;
  const eye = add(add(head.c, mul(head.ax[1], 0.075)), mul(head.ax[2], 0.03)), toBall = norm(sub(ball, eye));
  const gaze = { angle: deg(Math.acos(clamp(dot(toBall, head.ax[1]), -1, 1))), blockedBy: [] as string[], penalty: 0 };
  const before = penalty;
  for (const q of body.parts) if (SELF_VIEW.has(q.name)) { const m = occlusion(q.shape, eye, ball).m + 0.005; if (m > 0) { gaze.blockedBy.push(q.label); if (atContact) flag(m, `server's own ${q.label} blocks the server's view of the ball`); } }
  if (atContact) flag((gaze.angle - GAZE_MAX) * 0.002, `server cannot watch the ball (${gaze.angle.toFixed(0)}° off the face direction)`);
  gaze.penalty = penalty - before;

  return {
    s: sc, phase: phase(sc, tz.sApex), ball, vol, body, tz, eyes: eyeEvals, occ,
    hidden: pick(eyeEvals.map((e) => e.anyMin)) > 0, hiddenBy: SERVER_CATS.filter((c) => occ[c] > 0),
    arm, armMin, legal: armMin > 0, delta, pNet, pNetInside: Math.abs(pNet[0]) <= st.halfSpan && pNet[2] >= TABLE_H,
    gaze, issues, penalty,
  };
}

/** Sample the whole toss: when does the free arm leave the volume for good, and is the ball ever hidden? */
export function scanTimeline(p: Pose, st: Settings, n = 60) {
  const frames = Array.from({ length: n + 1 }, (_, i) => { const e = evaluate(p, st, i / n); return { s: i / n, legal: e.legal, hidden: e.hidden, hiddenBy: e.hiddenBy }; });
  let exit = 1.0001;
  for (let i = n; i >= 0 && frames[i].legal; i--) exit = frames[i].s;
  return { frames, exit }; // exit > 1 ⇒ illegal at contact
}
