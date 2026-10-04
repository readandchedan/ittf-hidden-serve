// Self-check of the geometry core: `npm run check`. Fails loudly (assert) if any invariant breaks.
import assert from 'node:assert/strict';
import { L, lang, setLang } from '../src/i18n';
import { DIM } from '../src/body';
import {
  boxDepth, dist, inVolume, lerp, makeVolume, NET_TOP, occlusion, pointClearance, POST_OUT, rng, sdSegment, sdVolume, segmentHitsVolume,
  TABLE_H, type Floor, type Shape, type V3,
} from '../src/geom';
import { DEFAULT_SETTINGS, evaluate, PRESETS } from '../src/serve';

const rand = rng(1);
const U = (a: number, b: number) => a + (b - a) * rand();

// 1. Hand-checked points for B = (0, −1.5, 1.0)
const B: V3 = [0, -1.5, 1.0];
const hull = makeVolume(B, POST_OUT, 'hull'), prism = makeVolume(B, POST_OUT, 'prism');
assert(inVolume(hull, [0, -1.0, 1.2]), 'above the floor, inside the wedge');
assert(!inVolume(hull, [0, -1.0, 0.85]) && inVolume(prism, [0, -1.0, 0.85]), 'hull floor at y=−1 is z=0.92; prism floor is 0.76');
assert(!inVolume(hull, [0.4, -1.0, 1.2]), 'outside the plan-view wedge (half-width 0.305 at y=−1)');
assert(!inVolume(hull, [0, 0.05, 1.2]) && !inVolume(hull, [0, -1.55, 1.2]), 'beyond the net / behind the ball');
assert(inVolume(hull, [0, -1.4999, 30]), 'indefinite upward extension');

for (const floor of ['hull', 'netTop', 'prism'] as Floor[]) {
  const zf = floor === 'netTop' ? NET_TOP : TABLE_H;
  for (let k = 0; k < 300; k++) {
    const w = U(0.76, 0.92), Bk: V3 = [U(-1.2, 1.2), U(-2.2, -1.4), U(0.8, 1.5)], V = makeVolume(Bk, w, floor);
    // 2. Exterior distance is minimal: no point of conv(B ∪ N) is closer than sdVolume says.
    const p: V3 = [U(-2, 2), U(-2.5, 0.5), U(0.5, 2.5)], d = sdVolume(V, p);
    for (let i = 0; i < 60; i++) {
      const q = lerp(Bk, [U(-w, w), 0, U(zf, 3)], U(0, 1));
      if (inVolume(V, q)) assert(dist(p, q) >= d - 1e-9, `sdVolume not minimal (${floor})`);
    }
    // ...and attained: the distance is never larger than to the ball centre (a point of V).
    assert(d <= dist(p, Bk) + 1e-9);
    // 3. Segment signed distance agrees with dense sampling; its sign agrees with exact clipping.
    const a: V3 = [U(-1.5, 1.5), U(-2.4, 0.2), U(0.6, 2)], b: V3 = [U(-1.5, 1.5), U(-2.4, 0.2), U(0.6, 2)];
    let brute = Infinity;
    for (let i = 0; i <= 2000; i++) brute = Math.min(brute, sdVolume(V, lerp(a, b, i / 2000)));
    const sd = sdSegment(V, a, b).d;
    assert(sd <= brute + 1e-9 && sd >= brute - 2e-3, `sdSegment ${sd} vs brute ${brute}`);
    if (Math.abs(sd) > 1e-6) assert.equal(sd < 0, segmentHitsVolume(V, a, b), 'clipping and signed distance disagree');
  }
}

// 4. Sight-line lemma: if the eye→ball line crosses the net plane inside N, every point between the ball and
//    the net plane is inside the hull volume (so any obstruction on the server's side lies inside V).
let lemmaCases = 0;
for (let k = 0; k < 2000; k++) {
  const ball: V3 = [U(-1.0, 1.0), U(-2.0, -1.39), U(0.8, 1.5)], eye: V3 = [U(-0.8, 0.8), U(1.6, 2.4), U(1.1, 1.8)];
  const V = makeVolume(ball, POST_OUT, 'hull'), P = lerp(eye, ball, eye[1] / (eye[1] - ball[1]));
  if (Math.abs(P[0]) > POST_OUT || P[2] < TABLE_H) continue;
  lemmaCases++;
  for (let i = 0; i <= 20; i++) assert(sdVolume(V, lerp(P, ball, i / 20)) <= 1e-9, 'sight line left the volume');
}
assert(lemmaCases > 1500);

// 5. Occlusion sign agrees with brute-force sampling of the sight segment.
for (let k = 0; k < 500; k++) {
  const E: V3 = [U(-1, 1), U(1.5, 2.5), U(1.2, 1.7)], T: V3 = [U(-0.5, 0.5), U(-2, -1.5), U(0.8, 1.4)];
  const c = lerp(E, T, U(0.6, 1.1)), F: [V3, V3, V3] = [[1, 0, 0], [0, Math.cos(k), Math.sin(k)], [0, -Math.sin(k), Math.cos(k)]];
  const shapes: Shape[] = [
    { kind: 'capsule', a: [c[0] + U(-0.2, 0.2), c[1], c[2] + U(-0.2, 0.2)], b: [c[0] + U(-0.2, 0.2), c[1] + 0.1, c[2]], r: U(0.03, 0.1) },
    { kind: 'ellipsoid', c: [c[0] + U(-0.15, 0.15), c[1], c[2] + U(-0.15, 0.15)], ax: F, s: [U(0.05, 0.15), U(0.05, 0.15), U(0.05, 0.2)] },
  ];
  for (const sh of shapes) {
    const m = occlusion(sh, E, T).m;
    let hit = false;
    for (let i = 0; i <= 4000 && !hit; i++) hit = pointClearance(sh, lerp(E, T, i / 4000)) <= 0;
    if (Math.abs(m) > 2e-3) assert.equal(m > 0, hit, `${sh.kind} occlusion sign`);
  }
}

// 6. Kinematics keep bone lengths; default receiver sees every preset ball through the net span.
for (const { pose } of Object.values(PRESETS)) {
  const e = evaluate(pose, DEFAULT_SETTINGS), j = e.body.j;
  assert(Math.abs(dist(j.freeShoulder, j.freeElbow) - DIM.upperArm) < 1e-6 && Math.abs(dist(j.freeElbow, j.freeWrist) - DIM.forearm) < 1e-6);
  assert(Math.abs(dist(j.racketShoulder, j.racketElbow) - DIM.upperArm) < 1e-6);
  assert(e.pNetInside);
}
// 9. Shape vs box (table top): capsule depth matches brute force; ellipsoid sign matches dense sampling.
{
  const box: [V3, V3] = [[-0.3, -0.2, 0.73], [0.3, 0.2, 0.76]];
  const sdBox = (p: V3) => {
    const d = [0, 1, 2].map((i) => Math.max(box[0][i] - p[i], p[i] - box[1][i]));
    const out = Math.hypot(...d.map((x) => Math.max(x, 0)));
    return out > 0 ? out : Math.max(...d);
  };
  for (let k = 0; k < 300; k++) {
    const a: V3 = [U(-0.6, 0.6), U(-0.5, 0.5), U(0.5, 1.0)], b: V3 = [U(-0.6, 0.6), U(-0.5, 0.5), U(0.5, 1.0)], r = U(0.02, 0.1);
    let m = Infinity;
    for (let i = 0; i <= 4000; i++) m = Math.min(m, sdBox(lerp(a, b, i / 4000)));
    assert(Math.abs(boxDepth({ kind: 'capsule', a, b, r }, box) - (r - m)) < 1e-4, 'capsule–box depth');
    const th = U(0, Math.PI), c: V3 = [U(-0.5, 0.5), U(-0.45, 0.45), U(0.6, 0.9)];
    const ax: [V3, V3, V3] = [[Math.cos(th), Math.sin(th), 0], [-Math.sin(th) * 0.8, Math.cos(th) * 0.8, 0.6], [Math.sin(th) * 0.6, -Math.cos(th) * 0.6, 0.8]];
    const e: Shape = { kind: 'ellipsoid', c, ax, s: [U(0.08, 0.2), U(0.08, 0.2), U(0.08, 0.2)] }, d = boxDepth(e, box);
    if (k % 3) continue; // the grid below is slow
    let g = -Infinity; // deepest grid point of the box (pointClearance is a lower bound of the same metric)
    for (let i = 0; i <= 60; i++) for (let j = 0; j <= 40; j++) for (let l = 0; l <= 3; l++) g = Math.max(g, -pointClearance(e, [-0.3 + i / 100, -0.2 + j / 100, 0.73 + l / 100]));
    assert(d >= g - 1e-6, 'ellipsoid–box depth is at least the grid optimum');
  }
}

assert.equal(lang, 'zh', 'each visit starts in Chinese');
assert.equal(L('English', '中文'), '中文');
setLang('en');
assert.equal(L('English', '中文'), 'English');
setLang('zh');
console.log('geometry and language self-check passed');
