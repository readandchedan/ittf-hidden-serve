// Pure geometry (no Three.js): vectors, ITTF dimensions, the Law 2.6.5 volume, segment/shape tests.
//
// World frame, metres:  X = across the table (+X = the server's right),
//                       Y = server → receiver (net plane is Y = 0, server's end line Y = −1.37),
//                       Z = up from the floor (playing surface at Z = 0.76).

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const madd = (a: V3, b: V3, s: number): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
export const dist = (a: V3, b: V3) => len(sub(a, b));
export const lerp = (a: V3, b: V3, t: number): V3 => madd(a, sub(b, a), t);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const rad = (deg: number) => (deg * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

// ITTF Laws 2.1–2.3 (Statutes 2026)
export const TABLE_L = 2.74, TABLE_W = 1.525, TABLE_H = 0.76, NET_H = 0.1525, BALL_R = 0.02;
export const END_Y = -TABLE_L / 2; // server's end line
export const NET_TOP = TABLE_H + NET_H; // 0.9125
/** Table top as a solid 3 cm slab (no body part may enter it). */
export const TABLE_TOP: [V3, V3] = [[-TABLE_W / 2, END_Y, TABLE_H - 0.03], [TABLE_W / 2, -END_Y, TABLE_H]];
export const POST_OUT = TABLE_W / 2 + 0.1525; // outside limit of the net posts: |x| = 0.915

// ---------------------------------------------------------------------------------------------
// Law 2.6.5 volume.  N = the net and its indefinite upward extension = {y = 0, |x| ≤ w, z ≥ z₀}.
// V = conv({ball} ∪ N).  For a ball centre B (B_y < 0) this is exactly the intersection of four
// half-spaces (proof in README):
//   1. net plane            y ≤ 0
//   2,3. two vertical side planes through B and the vertical lines x = ±w, y = 0
//   4. floor                plane through B and the line {y = 0, z = z_f}   ('hull':  z_f = 0.76,
//                           'netTop': z_f = 0.9125)  or  z ≥ 0.76 everywhere ('prism', stricter)
// ---------------------------------------------------------------------------------------------
export type Plane = { n: V3; d: number }; // inside ⇔ n·x ≤ d  (n is a unit vector)
export type Floor = 'hull' | 'netTop' | 'prism';
export interface Volume { B: V3; planes: Plane[]; edges: { x0: V3; u: V3 }[]; verts: V3[] }

export function makeVolume(B: V3, halfSpan: number, floor: Floor): Volume {
  const planes: Plane[] = [{ n: [0, 1, 0], d: 0 }];
  for (const s of [1, -1]) {
    let n = norm([-B[1], -(s * halfSpan - B[0]), 0]); // ⊥ to (net end − B) in plan view
    if (n[0] * s < 0) n = mul(n, -1); // keep the opposite net end inside
    planes.push({ n, d: dot(n, B) });
  }
  if (floor === 'prism') planes.push({ n: [0, 0, -1], d: -TABLE_H });
  else {
    const zf = floor === 'hull' ? TABLE_H : NET_TOP;
    const n = norm([0, -(B[2] - zf), B[1]]);
    planes.push({ n, d: n[2] * zf });
  }
  // Candidate closest-point supports for exact exterior distance: plane-pair lines and plane-triple points.
  const edges: Volume['edges'] = [], verts: V3[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const a = planes[i], b = planes[j], u = cross(a.n, b.n), uu = dot(u, u);
      if (uu < 1e-12) continue;
      edges.push({ x0: mul(add(mul(cross(b.n, u), a.d), mul(cross(u, a.n), b.d)), 1 / uu), u: mul(u, 1 / Math.sqrt(uu)) });
      for (let k = j + 1; k < 4; k++) {
        const c = planes[k], det = dot(a.n, cross(b.n, c.n));
        if (Math.abs(det) < 1e-9) continue;
        const x = mul(add(add(mul(cross(b.n, c.n), a.d), mul(cross(c.n, a.n), b.d)), mul(u, c.d)), 1 / det);
        if (planeExcess({ B, planes, edges, verts }, x) <= 1e-9) verts.push(x);
      }
    }
  return { B, planes, edges, verts };
}

/** Vertices of V ∩ {z ≤ zCap} (for drawing the unbounded volume up to a finite height). */
export function capVertices(V: Volume, zCap: number): V3[] {
  const P: Plane[] = [...V.planes, { n: [0, 0, 1], d: zCap }], out: V3[] = [];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) {
    const [a, b, c] = [P[i], P[j], P[k]], det = dot(a.n, cross(b.n, c.n));
    if (Math.abs(det) < 1e-9) continue;
    const x = mul(add(add(mul(cross(b.n, c.n), a.d), mul(cross(c.n, a.n), b.d)), mul(cross(a.n, b.n), c.d)), 1 / det);
    if (P.every((pl) => dot(pl.n, x) - pl.d <= 1e-7)) out.push(x);
  }
  return out;
}

/** max_i (n_i·p − d_i): ≤ 0 inside. Inside V it equals minus the distance to the boundary. */
export function planeExcess(V: Volume, p: V3) {
  let m = -Infinity;
  for (const pl of V.planes) m = Math.max(m, dot(pl.n, p) - pl.d);
  return m;
}
export const inVolume = (V: Volume, p: V3) => planeExcess(V, p) <= 0;

/** Exact signed Euclidean distance from p to V (negative inside) and the closest point of V (p itself if inside). */
export function project(V: Volume, p: V3): { d: number; q: V3 } {
  const m = planeExcess(V, p);
  if (m <= 0) return { d: m, q: p };
  // Outside: the projection onto V lies on a face, an edge or a vertex; it is the closest *feasible*
  // projection onto the affine hulls of all plane subsets of size 1–3.
  let d = Infinity, q = p;
  const consider = (c: V3) => {
    const dc = dist(p, c);
    if (dc < d && planeExcess(V, c) <= 1e-9) { d = dc; q = c; }
  };
  for (const pl of V.planes) consider(madd(p, pl.n, -(dot(pl.n, p) - pl.d)));
  for (const e of V.edges) consider(madd(e.x0, e.u, dot(sub(p, e.x0), e.u)));
  for (const v of V.verts) consider(v);
  return { d, q };
}
export const sdVolume = (V: Volume, p: V3) => project(V, p).d;

/** min over the segment a→b of sdVolume. The signed distance to a convex set is convex along a line,
 *  so golden-section search finds the global minimum. Returns distance and its segment parameter. */
export function sdSegment(V: Volume, a: V3, b: V3): { d: number; t: number } {
  const f = (t: number) => sdVolume(V, lerp(a, b, t));
  const g = 0.6180339887498949;
  let lo = 0, hi = 1, x1 = hi - g, x2 = g, f1 = f(x1), f2 = f(x2);
  for (let i = 0; i < 30; i++) {
    if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = f(x1); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = f(x2); }
  }
  let best = f1 < f2 ? { d: f1, t: x1 } : { d: f2, t: x2 };
  for (const t of [0, 1]) { const d = f(t); if (d < best.d) best = { d, t }; }
  return best;
}

/** Exact boolean: does the segment a→b intersect V (Liang–Barsky clipping against the 4 half-spaces)? */
export function segmentHitsVolume(V: Volume, a: V3, b: V3): boolean {
  let t0 = 0, t1 = 1;
  const d = sub(b, a);
  for (const pl of V.planes) {
    const num = pl.d - dot(pl.n, a), den = dot(pl.n, d); // need den·t ≤ num
    if (Math.abs(den) < 1e-15) { if (num < 0) return false; continue; }
    if (den > 0) t1 = Math.min(t1, num / den); else t0 = Math.max(t0, num / den);
    if (t0 > t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Body primitives and sight-line tests
// ---------------------------------------------------------------------------------------------
export type Shape =
  | { kind: 'capsule'; a: V3; b: V3; r: number } // sphere when a == b
  | { kind: 'ellipsoid'; c: V3; ax: [V3, V3, V3]; s: V3 } // orthonormal axes, semi-axis lengths
  | { kind: 'disc'; c: V3; n: V3; u: V3; v: V3; a: number; b: number }; // thin elliptical plate

/** Closest points between segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection §5.1.9). */
export function segSeg(p1: V3, q1: V3, p2: V3, q2: V3): { d: number; s: number; t: number } {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), EPS = 1e-14;
  let s = 0, t = 0;
  if (a <= EPS && e <= EPS) { s = t = 0; }
  else if (a <= EPS) { t = clamp(f / e, 0, 1); }
  else {
    const c = dot(d1, r);
    if (e <= EPS) s = clamp(-c / a, 0, 1);
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > EPS ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  return { d: dist(madd(p1, d1, s), madd(p2, d2, t)), s, t };
}

const toUnit = (sh: Extract<Shape, { kind: 'ellipsoid' }>, p: V3): V3 => {
  const q = sub(p, sh.c);
  return [dot(q, sh.ax[0]) / sh.s[0], dot(q, sh.ax[1]) / sh.s[1], dot(q, sh.ax[2]) / sh.s[2]];
};

/** Does the sight segment E→T pass through the shape?  m > 0 ⇔ blocked (exact sign).
 *  |m| is a metric depth/miss distance (exact for capsules, a lower bound for ellipsoids and discs).
 *  t = fraction along E→T where the segment enters the shape (used to order occluders). */
export function occlusion(sh: Shape, E: V3, T: V3): { m: number; t: number } {
  if (sh.kind === 'capsule') {
    const q = segSeg(E, T, sh.a, sh.b);
    return { m: sh.r - q.d, t: q.s - Math.sqrt(Math.max(0, sh.r * sh.r - q.d * q.d)) / dist(E, T) };
  }
  if (sh.kind === 'ellipsoid') {
    const e = toUnit(sh, E), d = sub(toUnit(sh, T), e);
    const dd = dot(d, d), ed = dot(e, d), tc = clamp(-ed / dd, 0, 1);
    const disc = ed * ed - dd * (dot(e, e) - 1);
    return { m: (1 - len(madd(e, d, tc))) * Math.min(sh.s[0], sh.s[1], sh.s[2]), t: disc > 0 ? (-ed - Math.sqrt(disc)) / dd : tc };
  }
  const D = sub(T, E), den = dot(sh.n, D);
  const t = Math.abs(den) < 1e-12 ? -1 : dot(sh.n, sub(sh.c, E)) / den;
  if (t <= 0 || t >= 1) return { m: -1, t: 1 };
  const q = sub(madd(E, D, t), sh.c);
  return { m: (1 - Math.hypot(dot(q, sh.u) / sh.a, dot(q, sh.v) / sh.b)) * Math.min(sh.a, sh.b), t };
}

/** Penetration depth of a shape into an axis-aligned box (> 0 ⇔ they intersect; exact for capsules, a lower bound for ellipsoids; discs untested). */
export function boxDepth(sh: Shape, [lo, hi]: [V3, V3]): number {
  const sdBox = (p: V3) => {
    const d = [0, 1, 2].map((i) => Math.max(lo[i] - p[i], p[i] - hi[i]));
    const out = Math.hypot(...d.map((x) => Math.max(x, 0)));
    return out > 0 ? out : Math.max(...d);
  };
  if (sh.kind === 'capsule') { // sdBox is convex → golden-section search along the axis
    const f = (t: number) => sdBox(lerp(sh.a, sh.b, t));
    let a = 0, b = 1;
    for (let i = 0; i < 40; i++) { const m1 = b - (b - a) * 0.618, m2 = a + (b - a) * 0.618; if (f(m1) < f(m2)) b = m2; else a = m1; }
    return sh.r - f((a + b) / 2);
  }
  if (sh.kind === 'ellipsoid') { // closest box point in the ellipsoid's unit-sphere metric: convex QP by coordinate descent
    const Q = [0, 1, 2].map((i) => [0, 1, 2].map((j) => sh.ax.reduce((s, a, k) => s + (a[i] * a[j]) / (sh.s[k] * sh.s[k]), 0)));
    const q: V3 = [clamp(sh.c[0], lo[0], hi[0]), clamp(sh.c[1], lo[1], hi[1]), clamp(sh.c[2], lo[2], hi[2])];
    for (let it = 0; it < 30; it++) for (let i = 0; i < 3; i++) {
      let g = 0;
      for (let j = 0; j < 3; j++) if (j !== i) g += Q[i][j] * (q[j] - sh.c[j]);
      q[i] = clamp(sh.c[i] - g / Q[i][i], lo[i], hi[i]);
    }
    return (1 - len(toUnit(sh, q))) * Math.min(sh.s[0], sh.s[1], sh.s[2]);
  }
  return -Infinity;
}

/** Clearance between a point and a shape surface (negative inside; ellipsoid value is a lower bound). */
export function pointClearance(sh: Shape, p: V3): number {
  if (sh.kind === 'capsule') return segSeg(sh.a, sh.b, p, p).d - sh.r;
  if (sh.kind === 'ellipsoid') return (len(toUnit(sh, p)) - 1) * Math.min(sh.s[0], sh.s[1], sh.s[2]);
  return Infinity;
}

/** Sight segment E→T passes below the net top between the posts? (the physical net blocks the view) */
export function netBlocks(E: V3, T: V3) {
  if (E[1] * T[1] >= 0) return false;
  const t = E[1] / (E[1] - T[1]), x = E[0] + t * (T[0] - E[0]), z = E[2] + t * (T[2] - E[2]);
  return Math.abs(x) <= POST_OUT && z <= NET_TOP;
}

/** Deterministic RNG (mulberry32) so searches are reproducible. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
