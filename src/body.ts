// Simplified right-handed server: ellipsoids + capsules + a thin racket plate, driven by a few
// joint-level parameters. Geometry over looks: every rendered shape is exactly the tested shape.
import { add, BALL_R, boxDepth, clamp, cross, dot, len, lerp, madd, mul, norm, pointClearance, rad, sub, TABLE_TOP, type Shape, type V3 } from './geom';

export type Cat = 'head' | 'neck' | 'shoulder' | 'torso' | 'freeArm' | 'racketArm' | 'racket' | 'leg';
export interface Part { name: string; label: string; cat: Cat; shape: Shape }

/** Pose at the moment of contact (angles in degrees, lengths in metres). Right-handed server. */
export interface Pose {
  preset: string;
  px: number; py: number; hipH: number; // hip-joint midpoint: plan position and height (stance depth)
  yaw: number; // body facing: 0 = chest faces the receiver (+Y); −90 = chest faces +X (left shoulder to the net)
  lean: number; // forward trunk flexion at the hips
  sideLean: number; // lateral trunk bend, + = towards the server's right
  twist: number; // thorax (shoulder-line) rotation relative to the pelvis, + = counter-clockwise from above
  headFlex: number; // neck flexion, + = head forward/down
  headLat: number; // neck lateral bend, + = towards the server's right
  fhX: number; fhY: number; fhZ: number; // free wrist relative to free shoulder, thorax frame (right, forward, up)
  freeSwivel: number; // free elbow swivel about shoulder→wrist axis: 0 = elbow lowest, + = elbow out
  racketAz: number; racketEl: number; // direction blade→ball (yaw frame: az from forward towards right; elevation)
  racketRoll: number; // handle direction about that normal: 0 = handle up
  racketSwivel: number; // racket elbow swivel
  relFwd: number; relLat: number; relZ: number; // toss release point: forward/lateral of hip midpoint (yaw frame), height
  backToss: number; // horizontal drift release→contact towards the body (m)
  tossAz: number; // drift direction: 0 = straight back towards the chest, + = towards the server's right
  apex: number; // rise above release (Law 2.6.2 requires ≥ 0.16 m)
  contactZ: number; // contact height
}

/** Adult male ≈ 1.78 m (rounded anthropometric proportions). Single source of body dimensions. */
export const DIM = {
  shoulderZ: 0.51, shoulderHalf: 0.185, neckBaseZ: 0.55, // along the trunk axis from the hip joints
  upperArm: 0.31, forearm: 0.26, rUpper: 0.045, rFore: 0.037, rHand: 0.042, handSeg: [0.035, 0.15],
  rDeltoid: 0.055, rGirdle: 0.05, rNeck: 0.055, neckLen: 0.09,
  head: [0.078, 0.098, 0.115] as V3, headOff: [0, 0.02, 0.19] as V3, // head centre from neck base (head frame)
  torso: [0.165, 0.115, 0.25] as V3, torsoZ: 0.32, pelvis: [0.17, 0.11, 0.13] as V3, pelvisZ: 0.05,
  thigh: 0.44, shank: 0.44, rThigh: 0.075, rShank: 0.05, hipHalf: 0.09, footHalf: 0.24,
  blade: [0.079, 0.075], bladeToGrip: 0.135, gripToWrist: 0.075, rHandle: 0.015,
};

type Frame = [V3, V3, V3]; // local x (right), y (forward), z (up) in world coordinates
const toWorld = (F: Frame, l: V3): V3 => add(add(mul(F[0], l[0]), mul(F[1], l[1])), mul(F[2], l[2]));
function rot(F: Frame, axis: 0 | 1 | 2, deg: number): Frame {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), [X, Y, Z] = F;
  if (axis === 0) return [X, add(mul(Y, c), mul(Z, s)), add(mul(Y, -s), mul(Z, c))];
  if (axis === 1) return [add(mul(X, c), mul(Z, -s)), Y, add(mul(X, s), mul(Z, c))];
  return [add(mul(X, c), mul(Y, s)), add(mul(X, -s), mul(Y, c)), Z];
}
export function frames(p: Pose) {
  const yawF = rot([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 2, p.yaw);
  const trunk = rot(rot(yawF, 0, -p.lean), 1, p.sideLean);
  const thorax = rot(trunk, 2, p.twist);
  const head = rot(rot(thorax, 0, -p.headFlex), 1, p.headLat);
  return { yawF, trunk, thorax, head };
}

/** Analytic two-bone IK. Swivel 0 puts the elbow (knee) towards `ref`, positive swivel towards `out`. */
function ik(S: V3, W: V3, L1: number, L2: number, swivel: number, ref: V3, out: V3) {
  const d = sub(W, S), D = len(d), u = mul(d, 1 / D);
  const lo = Math.abs(L1 - L2) + 1e-4, hi = L1 + L2 - 1e-4, Dc = clamp(D, lo, hi);
  const a = (L1 * L1 - L2 * L2 + Dc * Dc) / (2 * Dc), R = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let v1 = sub(ref, mul(u, dot(ref, u)));
  if (len(v1) < 1e-6) v1 = sub(out, mul(u, dot(out, u)));
  v1 = norm(v1);
  let v2 = cross(u, v1);
  if (dot(v2, out) < 0) v2 = mul(v2, -1);
  const E = add(madd(S, u, a), add(mul(v1, R * Math.cos(rad(swivel))), mul(v2, R * Math.sin(rad(swivel)))));
  const miss = Math.max(0, D - hi, lo - D);
  return { E, W: miss > 0 ? madd(E, norm(sub(W, E)), L2) : W, miss };
}

/** Racket blade placed so the ball (at `ball`) touches the face centre. n points blade → ball, h blade → handle. */
export function racketFrame(p: Pose, ball: V3) {
  const { yawF } = frames(p);
  const az = rad(p.racketAz), el = rad(p.racketEl), ro = rad(p.racketRoll);
  const n = norm(add(mul(add(mul(yawF[1], Math.cos(az)), mul(yawF[0], Math.sin(az))), Math.cos(el)), [0, 0, Math.sin(el)]));
  let e1 = sub([0, 0, 1], mul(n, n[2]));
  e1 = norm(len(e1) < 1e-6 ? yawF[1] : e1);
  const h = add(mul(e1, Math.cos(ro)), mul(cross(n, e1), Math.sin(ro)));
  const BC = madd(ball, n, -(BALL_R + 0.006)), G = madd(BC, h, DIM.bladeToGrip);
  return { n, h, BC, G, W: madd(G, h, DIM.gripToWrist) };
}

/** Free wrist while the ball rests on the open palm at R (palm centre ≈ 7 cm from the wrist, towards the ball). */
export function releaseWrist(SF: V3, R: V3): V3 {
  return madd(add(R, [0, 0, -(BALL_R + 0.025)]), norm([SF[0] - R[0], SF[1] - R[1], 0]), 0.07);
}

export interface Body { parts: Part[]; j: Record<string, V3>; issues: string[]; penalty: number }

const cap = (name: string, label: string, cat: Cat, a: V3, b: V3, r: number): Part => ({ name, label, cat, shape: { kind: 'capsule', a, b, r } });
const ell = (name: string, label: string, cat: Cat, c: V3, F: Frame, s: V3): Part => ({ name, label, cat, shape: { kind: 'ellipsoid', c, ax: F, s } });

/** Build all body parts. `racketAt` = point the blade face touches. `release` (timeline only) blends the free
 *  wrist from "palm under the ball at release point R" (w = 0) to the pose's free-hand target (w = 1). */
export function buildBody(p: Pose, racketAt: V3, release?: { R: V3; w: number }): Body {
  const { yawF, trunk, thorax, head } = frames(p);
  const P: V3 = [p.px, p.py, p.hipH];
  const SC = madd(P, trunk[2], DIM.shoulderZ), NB = madd(P, trunk[2], DIM.neckBaseZ);
  const SF = madd(SC, thorax[0], -DIM.shoulderHalf), SR = madd(SC, thorax[0], DIM.shoulderHalf);
  const headC = add(NB, toWorld(head, DIM.headOff));
  const parts: Part[] = [
    ell('head', 'head', 'head', headC, head, DIM.head),
    cap('neck', 'neck', 'neck', NB, madd(NB, head[2], DIM.neckLen), DIM.rNeck),
    ell('torso', 'torso', 'torso', madd(P, trunk[2], DIM.torsoZ), thorax, DIM.torso),
    ell('pelvis', 'torso (pelvis)', 'torso', madd(P, trunk[2], DIM.pelvisZ), trunk, DIM.pelvis),
    cap('freeGirdle', 'free-side shoulder (trapezius)', 'shoulder', NB, SF, DIM.rGirdle),
    cap('racketGirdle', 'racket-side shoulder (trapezius)', 'shoulder', NB, SR, DIM.rGirdle),
    cap('freeShoulder', 'free shoulder (deltoid)', 'shoulder', SF, SF, DIM.rDeltoid),
    cap('racketShoulder', 'racket shoulder (deltoid)', 'shoulder', SR, SR, DIM.rDeltoid),
  ];
  const issues: string[] = [];
  let penalty = 0;
  const flag = (amount: number, msg: string) => { if (amount > 0) { penalty += amount; issues.push(msg); } };

  // Free (left) arm — part of Law 2.6.5's "free arm and hand"
  let fT = add(SF, toWorld(thorax, [p.fhX, p.fhY, p.fhZ]));
  if (release) fT = lerp(releaseWrist(SF, release.R), fT, release.w);
  const fa = ik(SF, fT, DIM.upperArm, DIM.forearm, p.freeSwivel, [0, 0, -1], mul(thorax[0], -1));
  const fDir = norm(sub(fa.W, fa.E));
  const handF = madd(fa.W, fDir, (DIM.handSeg[0] + DIM.handSeg[1]) / 2);
  parts.push(
    cap('freeUpperArm', 'free upper arm', 'freeArm', SF, fa.E, DIM.rUpper),
    cap('freeForearm', 'free forearm', 'freeArm', fa.E, fa.W, DIM.rFore),
    cap('freeHand', 'free hand', 'freeArm', madd(fa.W, fDir, DIM.handSeg[0]), madd(fa.W, fDir, DIM.handSeg[1]), DIM.rHand),
  );
  flag(fa.miss, 'free hand target out of reach');

  // Racket (right) arm + racket
  const rk = racketFrame(p, racketAt);
  const ra = ik(SR, rk.W, DIM.upperArm, DIM.forearm, p.racketSwivel, [0, 0, -1], thorax[0]);
  flag(ra.miss, 'racket cannot reach the ball');
  flag((0.2 - rk.n[1]) * 0.1, 'racket face does not push the ball towards the receiver');
  const wristBend = Math.acos(clamp(dot(norm(sub(ra.W, ra.E)), mul(rk.h, -1)), -1, 1)) * 180 / Math.PI;
  flag((wristBend - 100) * 0.005, `racket wrist bent ${wristBend.toFixed(0)}° (> 100°)`);
  parts.push(
    cap('racketUpperArm', 'racket upper arm', 'racketArm', SR, ra.E, DIM.rUpper),
    cap('racketForearm', 'racket forearm', 'racketArm', ra.E, ra.W, DIM.rFore),
    cap('racketHand', 'racket hand', 'racketArm', madd(ra.W, rk.h, -0.015), madd(ra.W, rk.h, -0.09), DIM.rHand),
    cap('racketHandle', 'racket handle', 'racket', madd(rk.G, rk.h, 0.05), madd(rk.G, rk.h, -0.055), DIM.rHandle),
  );

  parts.push({ name: 'racketBlade', label: 'racket blade', cat: 'racket', shape: { kind: 'disc', c: rk.BC, n: rk.n, u: mul(rk.h, -1), v: norm(cross(rk.n, rk.h)), a: DIM.blade[0], b: DIM.blade[1] } });

  // Legs (context + occluders near hip height)
  for (const [side, sg] of [['L', -1], ['R', 1]] as const) {
    const hip = madd(P, yawF[0], sg * DIM.hipHalf);
    const ankle = madd([p.px, p.py, 0.08], yawF[0], sg * DIM.footHalf);
    const k = ik(hip, ankle, DIM.thigh, DIM.shank, 0, yawF[1], yawF[1]);
    parts.push(cap('thigh' + side, 'thigh', 'leg', hip, k.E, DIM.rThigh), cap('shin' + side, 'shin', 'leg', k.E, k.W, DIM.rShank));
  }

  // The table top is solid (matters once the server stands close to the end line).
  for (const q of parts) flag(boxDepth(q.shape, TABLE_TOP), `${q.label} touches the table`);

  // Self-collision: arm axis points and the racket blade (centre + rim) must stay outside head/torso/pelvis/thighs.
  const solid = parts.filter((q) => ['torso', 'pelvis', 'head', 'thighL', 'thighR'].includes(q.name));
  const probe = (pt: V3, what: string) => { for (const q of solid) flag(-pointClearance(q.shape, pt), `${what} inside ${q.label}`); };
  probe(fa.E, 'free elbow'); probe(fa.W, 'free wrist'); probe(handF, 'free hand');
  probe(ra.E, 'racket elbow'); probe(ra.W, 'racket wrist'); probe(rk.G, 'racket grip'); probe(rk.BC, 'racket blade');
  const bu = mul(rk.h, -1), bv = norm(cross(rk.n, rk.h));
  for (let k = 0; k < 8; k++) probe(add(add(rk.BC, mul(bu, DIM.blade[0] * Math.cos(k * Math.PI / 4))), mul(bv, DIM.blade[1] * Math.sin(k * Math.PI / 4))), 'racket blade edge');

  const j = { pelvis: P, shoulderC: SC, neckBase: NB, head: headC, freeShoulder: SF, freeElbow: fa.E, freeWrist: fa.W, freeHand: handF,
    racketShoulder: SR, racketElbow: ra.E, racketWrist: ra.W, racketHand: madd(ra.W, rk.h, -0.05), grip: rk.G, blade: rk.BC };
  return { parts, j, issues, penalty };
}
