// UI: Three.js scene, camera presets + insets, GUI, live rule status, search / sweep / comparison tables.
import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Cat, Part, Pose } from './body';
import { capVertices, deg, dist, dot, lerp, NET_H, norm, POST_OUT, project, sub, TABLE_H, TABLE_L, TABLE_W, type V3 } from './geom';
import { SWEEP_D, SWEEP_TARGETS, type CompareRow, type Found, type Key, type SweepCell } from './search';
import { L, lang, setLang, tr, trIssue } from './i18n';
import { DEFAULT_SETTINGS, evaluate, eyes, GAZE_MAX, PRESETS, scanTimeline, TARGETS, type Eval, type EyeEval, type Settings, type Target } from './serve';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const v3 = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);
const cm = (m: number) => `${m >= 0 ? '+' : ''}${(m * 100).toFixed(1)} cm`;
const $ = (id: string) => document.getElementById(id)!;
const el = (cls: string, text = '') => Object.assign(document.createElement('div'), { className: cls, textContent: text });
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

type View = '3d' | 'receiver' | 'overhead' | 'side';
const S = {
  preset: 'backhand',
  pose: { ...PRESETS.backhand.pose } as Pose,
  st: { ...DEFAULT_SETTINGS } as Settings,
  t: 1,
  view: '3d' as View,
  receiverFov: 40,
  show: { volume: true, eyeRays: true, skeleton: false, coordinates: true, tossTrajectory: true, hiddenBall: true, labels: true, insets: true, ttrCone: false },
  focus: null as Target | null, // obstruction group highlighted after loading a search result
};

// ------------------------------------------------------------------------------------------- scene
const host = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.appendChild(renderer.domElement);
const css = new CSS2DRenderer();
Object.assign(css.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
host.appendChild(css.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14171c);
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3340, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(2.5, -2, 5);
scene.add(sun);

const cam = new THREE.PerspectiveCamera(45, 1, 0.01, 60);
cam.position.set(3.4, -3.9, 2.4);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(-0.35, -1.25, 1.0);
controls.enableDamping = true;
const insetCams = { receiver: new THREE.PerspectiveCamera(), overhead: new THREE.PerspectiveCamera(), side: new THREE.PerspectiveCamera() };

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
function box(w: number, d: number, h: number, color: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), std(color));
  m.position.set(x, y, z);
  scene.add(m);
}
box(TABLE_W, TABLE_L, 0.03, 0x1b4f8f, 0, 0, TABLE_H - 0.015);
for (const s of [-1, 1]) {
  box(0.02, TABLE_L, 0.002, 0xffffff, s * (TABLE_W / 2 - 0.01), 0, TABLE_H + 0.001);
  box(TABLE_W, 0.02, 0.002, 0xffffff, 0, s * (TABLE_L / 2 - 0.01), TABLE_H + 0.001);
  box(0.02, 0.03, NET_H, 0x30343a, s * (POST_OUT - 0.01), 0, TABLE_H + NET_H / 2);
  for (const t of [-1, 1]) box(0.05, 0.05, TABLE_H - 0.03, 0x2b3038, s * (TABLE_W / 2 - 0.12), t * (TABLE_L / 2 - 0.25), (TABLE_H - 0.03) / 2);
}
box(0.003, TABLE_L, 0.002, 0xffffff, 0, 0, TABLE_H + 0.001);
const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * POST_OUT, NET_H), new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
netMesh.rotation.x = Math.PI / 2;
netMesh.position.set(0, 0, TABLE_H + NET_H / 2);
scene.add(netMesh, new THREE.Mesh(new THREE.PlaneGeometry(14, 14), std(0x181b20)));
const grid = new THREE.GridHelper(14, 28, 0x2a3039, 0x20252c);
grid.rotation.x = Math.PI / 2;
grid.position.z = 0.001;
scene.add(grid);

const coords = new THREE.Group();
coords.position.set(TABLE_W / 2 + 0.35, -TABLE_L / 2, TABLE_H);
coords.add(new THREE.AxesHelper(0.4));
const coordLabels = ([['X', [0.45, 0, 0]], ['Y', [0, 0.45, 0]], ['Z', [0, 0, 0.45]]] as const).map(([txt, p]) => {
  const o = new CSS2DObject(el('lbl', txt));
  o.position.set(p[0], p[1], p[2]);
  coords.add(o);
  return o.element;
});
const coordY = coordLabels[1];
scene.add(coords);

// ball, hidden-ball ghost, toss path
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 16), std(0xff8c1a, { emissive: 0xff6a00, emissiveIntensity: 0.8 }));
const ballRing = el('ballring');
ball.add(new CSS2DObject(ballRing));
const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff4d4d, wireframe: true, depthTest: false, transparent: true }));
ghost.renderOrder = 10;
scene.add(ball, ghost);
const tossGroup = new THREE.Group();
scene.add(tossGroup);

// receiver head + eyes
const recvHead = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), std(0x6f7782));
recvHead.scale.set(0.078, 0.098, 0.115);
const eyeMeshes = [0, 1, 2].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })));
eyeMeshes[2].visible = false;
const eyeLabels = ['L eye', 'R eye'].map((t, i) => { const o = new CSS2DObject(el('lbl', t)); eyeMeshes[i].add(o); return o; });
scene.add(recvHead, ...eyeMeshes);

// body parts: one mesh per part, geometry rebuilt only if its dimensions change
const COLORS: Record<Cat, number> = { head: 0xd8bf9f, neck: 0xd8bf9f, shoulder: 0xb7a184, torso: 0x8f99a5, freeArm: 0x3b82f6, racketArm: 0x22a06b, racket: 0xc0392b, leg: 0x4f5864 };
const bodyGroup = new THREE.Group();
scene.add(bodyGroup);
const partMeshes = new Map<string, { mesh: THREE.Mesh; key: string }>();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function partMesh(part: Part) {
  const sh = part.shape;
  const key = sh.kind === 'capsule' ? `c${sh.r}:${dist(sh.a, sh.b).toFixed(4)}` : sh.kind;
  let rec = partMeshes.get(part.name);
  if (!rec || rec.key !== key) {
    if (rec) { bodyGroup.remove(rec.mesh); rec.mesh.geometry.dispose(); }
    const geo = sh.kind === 'capsule' ? new THREE.CapsuleGeometry(sh.r, dist(sh.a, sh.b), 8, 20)
      : sh.kind === 'ellipsoid' ? new THREE.SphereGeometry(1, 32, 20) : new THREE.CylinderGeometry(1, 1, 0.008, 40);
    rec = { mesh: new THREE.Mesh(geo, std(COLORS[part.cat])), key };
    bodyGroup.add(rec.mesh);
    partMeshes.set(part.name, rec);
  }
  const m = rec.mesh;
  if (sh.kind === 'capsule') {
    m.position.copy(v3(lerp(sh.a, sh.b, 0.5)));
    const d = sub(sh.b, sh.a);
    m.quaternion.setFromUnitVectors(Y_AXIS, dot(d, d) > 1e-12 ? v3(norm(d)) : Y_AXIS);
  } else if (sh.kind === 'ellipsoid') {
    m.position.copy(v3(sh.c));
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(sh.ax[0]), v3(sh.ax[1]), v3(sh.ax[2])));
    m.scale.set(sh.s[0], sh.s[1], sh.s[2]);
  } else {
    m.position.copy(v3(sh.c));
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(sh.u), v3(sh.n), v3(sh.v)));
    m.scale.set(sh.a, 1, sh.b);
  }
  return m;
}
const jointLabels = new Map<string, [CSS2DObject, string]>();
const JOINT_LABELS: [string, string, string][] = [
  ['freeHand', 'free hand', 'free'], ['freeElbow', 'free elbow', 'free'], ['freeShoulder', 'free shoulder', 'free'],
  ['racketHand', 'racket hand', 'racket'], ['racketShoulder', 'racket shoulder', 'racket'], ['head', 'head', ''], ['torso', 'torso', ''],
];
for (const [k, t, c] of JOINT_LABELS) { const o = new CSS2DObject(el(`lbl ${c}`, t)); jointLabels.set(k, [o, t]); scene.add(o); }

// volume, rays, skeleton, clearance line (rebuilt per update)
const volMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
const volEdgeMat = new THREE.LineBasicMaterial({ color: 0xff5050 });
const dyn = new THREE.Group();
scene.add(dyn);
const clrLabel = new CSS2DObject(el('lbl'));
scene.add(clrLabel);
const line = (pts: V3[], color: number, opts: { dashed?: boolean; onTop?: boolean } = {}) => {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map(v3));
  const mat = opts.dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.03, gapSize: 0.02, depthTest: !opts.onTop }) : new THREE.LineBasicMaterial({ color, depthTest: !opts.onTop });
  const l = new THREE.Line(g, mat);
  if (opts.dashed) l.computeLineDistances();
  if (opts.onTop) l.renderOrder = 9;
  dyn.add(l);
};
const dot3 = (p: V3, color: number, r = 0.012) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false })); m.renderOrder = 9; m.position.copy(v3(p)); dyn.add(m); };

// ------------------------------------------------------------------------------------------- update
let E: Eval;
let scanKey = '';
let scan = scanTimeline(S.pose, S.st);

function update() {
  E = evaluate(S.pose, S.st, S.t, true);
  const key = JSON.stringify([S.pose, S.st]);
  if (key !== scanKey) { scanKey = key; scan = scanTimeline(S.pose, S.st); }
  for (const c of dyn.children) { (c as THREE.Mesh).geometry?.dispose(); }
  dyn.clear();

  // body
  const occluders = new Set(E.eyes.filter((x) => x.name !== 'center' || S.st.criterion === 'center').flatMap((x) => x.hits.map((h) => h.part.name)));
  const illegal = new Set(E.arm.filter((a) => a.clr <= 0).map((a) => a.part.name));
  for (const part of E.body.parts) {
    const mat = partMesh(part).material as THREE.MeshStandardMaterial;
    mat.color.setHex(illegal.has(part.name) ? 0xff2d2d : occluders.has(part.name) ? 0xffd400 : COLORS[part.cat]);
    mat.emissive.setHex(S.focus && TARGETS[S.focus](part) ? 0x4a3c00 : 0);
    if (mat.transparent !== S.show.skeleton) { mat.transparent = S.show.skeleton; mat.needsUpdate = true; }
    mat.opacity = S.show.skeleton ? 0.3 : 1;
  }
  const j = E.body.j, torso = E.body.parts.find((p) => p.name === 'torso')!.shape as { c: V3 };
  const labelsOn = S.show.labels && S.view !== 'receiver'; // receiver view stays uncluttered
  for (const [k, [o]] of jointLabels) { o.position.copy(v3(k === 'torso' ? torso.c : j[k])); o.visible = labelsOn; }
  if (S.show.skeleton) {
    for (const chain of [['pelvis', 'shoulderC', 'neckBase', 'head'], ['freeShoulder', 'freeElbow', 'freeWrist', 'freeHand'], ['racketShoulder', 'racketElbow', 'racketWrist', 'grip', 'blade'], ['freeShoulder', 'shoulderC', 'racketShoulder']])
      line(chain.map((k) => j[k]), 0xffffff, { onTop: true });
    for (const k of Object.keys(j)) dot3(j[k], k.startsWith('free') ? 0x8ec5ff : k.startsWith('racket') ? 0x8ff0b8 : 0xffffff, 0.01);
  }

  // ball
  ball.position.copy(v3(E.ball));
  ghost.position.copy(ball.position);
  ghost.visible = S.show.hiddenBall && E.hidden;
  ballRing.className = 'ballring' + (E.hidden ? ' hidden' : '');

  // 2.6.5 volume (drawn to 2.1 m; it continues indefinitely upwards)
  if (S.show.volume) {
    const geo = new ConvexGeometry(capVertices(E.vol, 2.1).map(v3));
    dyn.add(new THREE.Mesh(geo, volMat), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), volEdgeMat));
  }
  // minimum clearance between the free arm and the volume
  const worst = E.arm.reduce((a, b) => (b.clr < a.clr ? b : a));
  const ws = worst.part.shape as { a: V3; b: V3 }, wp = lerp(ws.a, ws.b, worst.t), wq = project(E.vol, wp).q;
  if (S.show.volume && dist(wp, wq) > 1e-6) line([wp, wq], 0xffd400, { dashed: true, onTop: true });
  clrLabel.position.copy(v3(lerp(wp, wq, 0.5)));
  clrLabel.element.textContent = `${tr(worst.part.label)}${L(': clearance ', '：净空 ')}${cm(worst.clr + S.st.margin)}`;
  clrLabel.visible = S.show.volume && labelsOn;
  volMat.opacity = S.view === 'receiver' ? 0.06 : 0.14;

  // receiver + eye rays
  const ev = eyes(S.st);
  ev.forEach((e, i) => eyeMeshes[i].position.copy(v3(e.p)));
  eyeLabels.forEach((o) => (o.visible = labelsOn));
  recvHead.position.set(S.st.recvX, ev[2].p[1] + 0.07, S.st.eyeH + 0.01);
  if (S.show.eyeRays)
    E.eyes.forEach((x, i) => {
      if (i === 2 && S.st.criterion !== 'center') return;
      const blocked = x.hits.length > 0 || x.net;
      line([x.p, E.ball], blocked ? 0xff5a52 : 0x3ccf7a, { dashed: i === 2 });
      if (x.hits[0]) dot3(lerp(x.p, E.ball, x.hits[0].t), 0xffd400);
    });

  // toss trajectory + TTR reference cone
  tossGroup.clear();
  tossGroup.visible = S.show.tossTrajectory;
  const tz = E.tz, path = Array.from({ length: 41 }, (_, i) => tz.at(i / 40));
  tossGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.map(v3)), new THREE.LineBasicMaterial({ color: 0xffc27a })));
  for (const [p, c] of [[tz.R, 0x3ccf7a], [tz.at(tz.sApex), 0xffffff], [tz.C, 0xff8c1a]] as [V3, number][]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), new THREE.MeshBasicMaterial({ color: c }));
    m.position.copy(v3(p));
    tossGroup.add(m);
  }
  if (S.show.ttrCone) {
    const h = 0.45, cone = new THREE.Mesh(new THREE.ConeGeometry(h * Math.tan(Math.PI / 6), h, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ad0ff, wireframe: true, transparent: true, opacity: 0.35 }));
    cone.rotation.x = -Math.PI / 2;
    cone.position.copy(v3(tz.R)).add(new THREE.Vector3(0, 0, h / 2));
    tossGroup.add(cone);
  }
  coords.visible = S.show.coordinates && S.view !== 'receiver';
  grid.visible = S.show.coordinates;
  ($('tick-apex') as HTMLOptionElement).value = String(tz.sApex);
  status();
}

// ------------------------------------------------------------------------------------------- status panel
const CAT_LABEL: Record<string, string> = { head: 'head', neck: 'neck', shoulder: 'shoulder', torso: 'torso', freeArm: 'free arm', racketArm: 'racket arm', racket: 'racket', leg: 'leg', shoulderFree: 'free-side shoulder', shoulderRacket: 'racket-side shoulder', anyBody: 'any body part' };
const catName = (c: string) => tr(CAT_LABEL[c] ?? c);
function eyeText(x: EyeEval) { // English: used in exported JSON
  if (x.hits.length) return `BLOCKED BY ${x.hits[0].part.label}`;
  return x.net ? 'BLOCKED BY NET' : 'VISIBLE';
}
const openSecs = new Set(['vis', 'arm']);
$('status').addEventListener('toggle', (ev) => { const d = ev.target as HTMLDetailsElement; if (d.open) openSecs.add(d.id); else openSecs.delete(d.id); }, true);
const sec = (id: string, title: string, body: string) => `<details id="${id}"${openSecs.has(id) ? ' open' : ''}><summary>${title}</summary><div class="sec">${body}</div></details>`;

function status() {
  const e = E, p = S.pose, tz = e.tz, m = S.st.margin;
  const pad = (s: string) => s + ' '.repeat(Math.max(1, (lang === 'zh' ? 7 : 12) - s.length));
  const eyeLine = (x: EyeEval, name: string) => {
    const vis = x.hits.length
      ? `<span class="bad">${L('BLOCKED — ', '被挡 — ')}${tr(x.hits[0].part.label).toUpperCase()}</span>${x.hits.length > 1 ? ` <span class="dim">(+ ${x.hits.slice(1).map((h) => tr(h.part.label)).join(', ')})</span>` : ''}`
      : x.net ? `<span class="warn">${L('BLOCKED — NET', '被网挡住')}</span>` : `<span class="ok">${L('VISIBLE', '可见')}</span>`;
    return `${pad(name)}${vis}\n${pad('')}<span class="dim">${L(`ball silhouette: ${x.blocked}/${x.n} sample rays blocked`, `球的轮廓：${x.n} 条采样射线中 ${x.blocked} 条被挡`)}</span>`;
  };
  const armLine = (name: string, part: string) => {
    const a = e.arm.find((q) => q.part.name === part)!;
    return `${pad(name)}${a.clr > 0 ? `<span class="ok">${L('LEGAL  ', '合法')}</span>` : `<span class="bad">${L('ILLEGAL', '违规')}</span>`}  <span class="dim">${L('clearance', '净空')} ${cm(a.clr + m)}</span>`;
  };
  const hiddenFrames = scan.frames.filter((f) => f.hidden).length;
  const j = e.body.j, elbowFlex = 180 - deg(Math.acos(dot(norm(sub(j.freeShoulder, j.freeElbow)), norm(sub(j.freeWrist, j.freeElbow)))));
  const by = e.hiddenBy.length ? e.hiddenBy.map(catName).join(' + ') : L('combination of parts', '多个部位共同');
  const ttrOver = tz.launch > 30 || tz.chord > 30;
  const exitTxt = scan.exit > 1 ? L('still in the volume at contact', '击球时仍在空间内') : L(`legal from t = ${(scan.exit * 100).toFixed(0)} % on`, `从 t = ${(scan.exit * 100).toFixed(0)} % 起合法`);
  const crit = { both: L('both eyes blocked', '双眼都被挡'), either: L('either eye blocked', '任一只眼被挡'), center: L('centre-eye approximation', '中心眼近似') }[S.st.criterion];
  const card = (ok: boolean, k: string, v: string, s: string) => `<div class="vcard ${ok ? 'ok' : 'bad'}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  $('verdicts').innerHTML =
    card(!e.hidden, L('Law 2.6.4 · visibility', '规则 2.6.4 · 可见性'), e.hidden ? L('HIDDEN', '被挡住') : L('VISIBLE', '可见'),
      e.hidden ? `${L('by', '遮挡物：')} ${by} · ${L('L', '左')} ${e.eyes[0].blocked}/${e.eyes[0].n} · ${L('R', '右')} ${e.eyes[1].blocked}/${e.eyes[1].n}` : L('the receiver sees the ball', '接发球员能看到球')) +
    card(e.legal, L('Law 2.6.5 · free arm', '规则 2.6.5 · 非持拍臂'), e.legal ? L('LEGAL', '合法') : L('ILLEGAL', '违规'),
      `${L('min clearance', '最小净空')} ${cm(e.armMin + m)} · ${exitTxt}`);
  const chip = (cls: string, s: string) => `<span class="chip ${cls}">${s}</span>`;
  const gazeOk = e.gaze.angle <= GAZE_MAX && !e.gaze.blockedBy.length;
  $('facts').innerHTML = [
    chip('', `t ${(e.s * 100).toFixed(0)} % · ${tr(e.phase)}`),
    chip(ttrOver ? 'warn' : '', `δ ${(p.backToss * 100).toFixed(0)} cm · ${L('toss', '抛球角')} ${tz.launch.toFixed(1)}° / ${tz.chord.toFixed(1)}°`),
    chip(gazeOk ? '' : 'bad', gazeOk ? L(`server sees ball (${e.gaze.angle.toFixed(0)}°)`, `发球员看得到球（${e.gaze.angle.toFixed(0)}°）`) : L('server cannot see ball', '发球员看不到球')),
    chip('', `Δ ${cm(e.delta)} · ${e.delta > 0 ? L('ball behind free hand', '球在非持拍手后方') : L('ball in front of free hand', '球在非持拍手前方')}`),
    e.issues.length ? chip('bad', L(`⚠ ${e.issues.length} pose issue(s)`, `⚠ ${e.issues.length} 项姿态问题`)) : '',
  ].join('');
  $('status').innerHTML = [
    sec('vis', L('Visibility · Law 2.6.4', '可见性 · 规则 2.6.4'), [
      eyeLine(e.eyes[0], L('Left eye', '左眼')), eyeLine(e.eyes[1], L('Right eye', '右眼')), eyeLine(e.eyes[2], L('Centre eye', '中心眼')),
      `${L('criterion (experiment, not ITTF)', '判据（实验参数，非 ITTF 规定）')}: ${crit}${S.st.wholeBall ? L(', whole ball', '，整个球') : L(', ball-centre ray', '，球心视线')}`,
      `→ ${e.hidden ? `<span class="bad">${L('HIDDEN', '被挡住')}</span> ${L('by', '：')} ${by}` : `<span class="ok">${L('VISIBLE', '可见')}</span>`}`,
      `<span class="dim">${L(`sight line crosses the net plane at x=${e.pNet[0].toFixed(2)}, z=${e.pNet[2].toFixed(2)}`, `视线在 x=${e.pNet[0].toFixed(2)}, z=${e.pNet[2].toFixed(2)} 处穿过网面`)} ${e.pNetInside ? L('(inside the net span ⇒ any obstruction lies inside the 2.6.5 volume)', '（在网宽内 ⇒ 任何遮挡物都在 2.6.5 空间内）') : L('(OUTSIDE the net span ⇒ obstruction need not lie in the volume)', '（在网宽之外 ⇒ 遮挡物不一定在空间内）')}</span>`,
    ].join('\n')),
    sec('arm', L('Law 2.6.5 · free arm', '规则 2.6.5 · 非持拍臂'), [
      armLine(L('Free hand', '手'), 'freeHand'), armLine(L('Forearm', '前臂'), 'freeForearm'), armLine(L('Upper arm', '上臂'), 'freeUpperArm'),
      `${L('Overall', '总体')}: ${e.legal ? `<span class="ok">${L('LEGAL', '合法')}</span>` : `<span class="bad">${L('ILLEGAL', '违规')}</span>`} <span class="dim">(${L('min clearance', '最小净空')} ${cm(e.armMin + m)}, ${L('required', '要求')} ${cm(m)})</span>`,
      `<span class="dim">${L(`free elbow flexion ${elbowFlex.toFixed(0)}°`, `非持拍肘屈曲 ${elbowFlex.toFixed(0)}°`)} · ${L('whole toss', '整个抛球')}: ${scan.exit > 1 ? `<span class="bad">${exitTxt}</span>` : exitTxt} · ${L(`ball hidden in ${hiddenFrames}/${scan.frames.length} frames`, `${scan.frames.length} 帧中 ${hiddenFrames} 帧球被挡`)}</span>`,
    ].join('\n')),
    sec('toss', L('Toss', '抛球'), [
      L(`backward displacement δ = ${(p.backToss * 100).toFixed(1)} cm · rise ${(p.apex * 100).toFixed(0)} cm`, `回抛距离 δ = ${(p.backToss * 100).toFixed(1)} cm · 抛起 ${(p.apex * 100).toFixed(0)} cm`),
      L(`toss angle: launch ${tz.launch.toFixed(1)}° · release→apex chord ${tz.chord.toFixed(1)}° from vertical`, `抛球角（相对竖直）：出手方向 ${tz.launch.toFixed(1)}° · 出手点→最高点连线 ${tz.chord.toFixed(1)}°`),
      `<span class="dim">${L('TTR review threshold 30° (ITTF operational, not in the Laws)', 'TTR 复核阈值 30°（ITTF 操作标准，不是规则条文）')}: ${ttrOver ? `<span class="warn">${L('exceeded', '已超出')}</span>` : L('within', '未超出')}</span>`,
    ].join('\n')),
    sec('delta', L('Ball vs free hand (receiver sight axis)', '球 vs 非持拍手（沿接发者视线）'),
      `Δ = ${cm(e.delta)} → <b>${e.delta > 0 ? L('BALL BEHIND FREE HAND', '球在非持拍手后方') : L('BALL IN FRONT OF FREE HAND', '球在非持拍手前方')}</b> <span class="dim">${L('(as seen from the receiver)', '（接发球员视角）')}</span>`),
    sec('checks', L('Pose checks', '姿态检查'), [
      e.issues.length ? `<span class="warn">${e.issues.map(trIssue).join('\n')}</span>` : `<span class="ok">${L('ok', '通过')}</span> <span class="dim">${L('(reach, self-collision, ball behind end line & above surface, falling at contact, server can watch the ball)', '（够得着、无自碰撞、球在端线后且高于台面、下落中击球、发球员能看着球）')}</span>`,
      `<span class="dim">${L(`server's view of the ball: ${e.gaze.angle.toFixed(0)}° off the face direction (limit ${GAZE_MAX}°)`, `发球员看球：偏离面部朝向 ${e.gaze.angle.toFixed(0)}°（上限 ${GAZE_MAX}°）`)}${e.gaze.blockedBy.length ? L(', blocked by own ', '，被自己的') + e.gaze.blockedBy.map(tr).join(L(', ', '、')) + L('', '挡住') : ''}</span>`,
    ].join('\n')),
  ].join('');
  $('phase').textContent = `${(S.t * 100).toFixed(0)} % · ${tr(e.phase)}`;
}

// ------------------------------------------------------------------------------------------- cameras
function placeCamera(c: THREE.PerspectiveCamera, view: Exclude<View, '3d'>, aspect: number) {
  const B = E.ball;
  c.aspect = aspect;
  c.up.set(0, 0, 1);
  if (view === 'receiver') { c.position.copy(v3(eyes(S.st)[2].p)); c.fov = S.receiverFov; c.lookAt(v3(B)); }
  else if (view === 'overhead') { c.up.set(0, 1, 0); c.position.set(B[0] * 0.5, -0.95, 5.2); c.fov = 42; c.lookAt(B[0] * 0.5, -0.95, 0.8); }
  else { c.position.set(4.6, B[1] + 0.35, 1.25); c.fov = 30; c.lookAt(B[0], B[1] + 0.35, 1.05); }
  c.near = 0.01; c.far = 60;
  c.updateProjectionMatrix();
}
let saved3d = { pos: cam.position.clone(), target: controls.target.clone() };
function setView(v: View) {
  if (S.view === '3d') saved3d = { pos: cam.position.clone(), target: controls.target.clone() };
  S.view = v;
  controls.enabled = v === '3d';
  if (v === '3d') { cam.position.copy(saved3d.pos); controls.target.copy(saved3d.target); cam.up.set(0, 0, 1); cam.fov = 45; cam.updateProjectionMatrix(); }
  document.querySelectorAll<HTMLButtonElement>('#views [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  update();
}
document.querySelectorAll<HTMLButtonElement>('#views [data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view as View)));
renderer.domElement.addEventListener('wheel', (ev) => {
  if (S.view !== 'receiver') return;
  S.receiverFov = Math.min(75, Math.max(4, S.receiverFov * (1 + ev.deltaY * 0.001)));
  ev.preventDefault();
}, { passive: false });

const insetLabels = (['receiver', 'overhead', 'side'] as const).map(() => { const d = el('inset-label'); host.appendChild(d); return d; });
function render() {
  requestAnimationFrame(render);
  const w = host.clientWidth, h = host.clientHeight;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) { renderer.setSize(w, h); css.setSize(w, h); }
  if (S.view === '3d') { cam.aspect = w / h; cam.updateProjectionMatrix(); controls.update(); } else placeCamera(cam, S.view, w / h);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, cam);
  css.render(scene, cam);
  const iw = Math.round(w * 0.24), ih = Math.round(iw * 0.72), gap = 8;
  insetLabels.forEach((d, i) => {
    d.style.display = S.show.insets ? 'block' : 'none';
    Object.assign(d.style, { left: `${w - (3 - i) * (iw + gap) + 6}px`, bottom: `${gap + ih - 22}px` });
  });
  if (!S.show.insets) return;
  renderer.setScissorTest(true);
  (['receiver', 'overhead', 'side'] as const).forEach((k, i) => {
    const x = w - (3 - i) * (iw + gap);
    renderer.setViewport(x, gap, iw, ih);
    renderer.setScissor(x, gap, iw, ih);
    placeCamera(insetCams[k], k, iw / ih);
    renderer.render(scene, insetCams[k]);
  });
}

// ------------------------------------------------------------------------------------------- timeline
const tInput = $('t') as HTMLInputElement;
tInput.oninput = () => { S.t = +tInput.value; update(); };
let playing = 0;
$('play').onclick = () => {
  if (playing) { cancelAnimationFrame(playing); playing = 0; $('play').textContent = '▶'; return; }
  $('play').textContent = '❚❚';
  let t0 = performance.now();
  const step = (now: number) => {
    S.t = ((now - t0) / 2500) % 1.15;
    if (S.t > 1) S.t = 1;
    if (now - t0 > 2500 * 1.15) t0 = now;
    tInput.value = String(S.t);
    update();
    playing = requestAnimationFrame(step);
  };
  playing = requestAnimationFrame(step);
};

// ------------------------------------------------------------------------------------------- GUI (rebuilt when the language changes)
type Ctl = [Key, string, number, number, number];
const TOSS_CTL: Ctl[] = [
  ['backToss', 'Toss backward displacement (m)', 0, 0.5, 0.005], ['tossAz', 'Drift direction (° from straight back)', -90, 90, 1],
  ['apex', 'Toss rise (m, ≥ 0.16)', 0.16, 1.0, 0.01], ['relFwd', 'Release: in front of hips (m)', 0.1, 0.8, 0.005],
  ['relLat', 'Release: lateral (m, + right)', -0.5, 0.5, 0.005], ['relZ', 'Release height (m)', 0.78, 1.4, 0.005], ['contactZ', 'Contact height (m)', 0.78, 1.5, 0.005],
];
const BODY_CTL: Ctl[] = [
  ['px', 'Server X (m)', -1.4, 1.2, 0.01], ['py', 'Server Y (m)', -2.4, -1.4, 0.01], ['hipH', 'Hip height (m)', 0.7, 1.0, 0.005],
  ['yaw', 'Torso yaw (°)', -120, 90, 1], ['lean', 'Torso lean (°)', 0, 60, 1], ['sideLean', 'Torso side lean (°)', -30, 30, 1],
  ['twist', 'Shoulder rotation (°)', -45, 45, 1], ['headFlex', 'Head lean (°)', -20, 70, 1], ['headLat', 'Head lateral (°)', -45, 45, 1],
  ['freeSwivel', 'Free elbow swivel (°)', -40, 130, 1], ['fhX', 'Free hand → right (m)', -0.6, 0.45, 0.005], ['fhY', 'Free hand → forward (m)', -0.5, 0.6, 0.005], ['fhZ', 'Free hand → up (m)', -0.65, 0.35, 0.005],
];
const RACKET_CTL: Ctl[] = [
  ['racketAz', 'Face azimuth (°)', -180, 180, 1], ['racketEl', 'Face elevation (°)', -60, 80, 1], ['racketRoll', 'Handle roll (°)', -180, 180, 1], ['racketSwivel', 'Racket elbow swivel (°)', -40, 130, 1],
];
const SHOW_NAMES: Record<keyof typeof S.show, string> = { volume: 'Show 2.6.5 volume', eyeRays: 'Show eye rays', skeleton: 'Show skeleton', coordinates: 'Show coordinates', tossTrajectory: 'Show toss trajectory', hiddenBall: 'Show hidden ball', labels: 'Show labels', insets: 'Show inset views', ttrCone: 'Show TTR 30° cone' };
const opts = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [tr(k), v]));
let gui: GUI;
const closed = new Set(['RACKET ARM', 'RECEIVER', 'RULE MODEL (experiment parameters)', 'DEBUG']);
function buildGui() {
  gui?.destroy();
  gui = new GUI({ container: $('gui'), title: tr('Controls') });
  const folder = (name: string) => { const f = gui.addFolder(tr(name)); if (closed.has(name)) f.close(); f.onOpenClose((x) => (x._closed ? closed.add(name) : closed.delete(name))); return f; };
  const addCtl = (f: GUI, list: Ctl[]) => list.forEach(([k, name, lo, hi, step]) => f.add(S.pose, k, lo, hi, step).name(tr(name)).onChange(() => { S.focus = null; update(); }));
  addCtl(folder('TOSS'), TOSS_CTL);
  addCtl(folder('BODY'), BODY_CTL);
  addCtl(folder('RACKET ARM'), RACKET_CTL);
  const fr = folder('RECEIVER');
  fr.add(S.st, 'recvX', -0.8, 0.8, 0.01).name(tr('Receiver X (m)')).onChange(update);
  fr.add(S.st, 'recvDist', 0.1, 1.5, 0.01).name(tr('Eyes behind own end line (m)')).onChange(update);
  fr.add(S.st, 'eyeH', 1.0, 1.8, 0.01).name(tr('Eye height (m)')).onChange(update);
  fr.add(S.st, 'ipd', 0.05, 0.075, 0.001).name(tr('Eye spacing (m)')).onChange(update);
  const fm = folder('RULE MODEL (experiment parameters)');
  fm.add(S.st, 'criterion', opts({ 'both eyes blocked': 'both', 'either eye blocked': 'either', 'centre-eye approximation': 'center' })).name(tr('Visibility criterion')).onChange(update);
  fm.add(S.st, 'wholeBall').name(tr('Whole ball must be hidden')).onChange(update);
  fm.add(S.st, 'halfSpan', opts({ 'net incl. posts (±0.915 m)': POST_OUT, 'net between posts (±0.895 m)': 0.895, 'table sidelines (±0.7625 m)': TABLE_W / 2 })).name(tr('2.6.5 net span')).onChange(update);
  fm.add(S.st, 'floor', opts({ 'convex hull, net from playing surface (literal)': 'hull', 'hull from net top only (lenient)': 'netTop', 'vertical prism above playing surface (strict)': 'prism' })).name(tr('2.6.5 lower boundary')).onChange(update);
  fm.add(S.st, 'margin', 0, 0.06, 0.001).name(tr('Required free-arm clearance (m)')).onChange(update);
  const fd = folder('DEBUG');
  for (const k of Object.keys(S.show) as (keyof typeof S.show)[]) fd.add(S.show, k).name(tr(SHOW_NAMES[k])).onChange(update);
}

function renderPresets() {
  $('presets').innerHTML = Object.entries(PRESETS).map(([k, v]) => `<button class="btn${k === S.preset ? ' on' : ''}" data-preset="${k}">${tr(v.label)}</button>`).join('');
}
$('presets').onclick = (ev) => { const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-preset]'); if (b) loadPose({ ...PRESETS[b.dataset.preset!].pose }, null, b.dataset.preset); };

function loadPose(p: Pose, focus: Target | null, preset?: string, st?: Settings) {
  Object.assign(S.pose, p);
  if (st) Object.assign(S.st, st);
  S.focus = focus;
  S.preset = preset ?? '';
  renderPresets();
  S.t = 1;
  tInput.value = '1';
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  update();
}

// ------------------------------------------------------------------------------------------- pose JSON
function poseJSON() {
  const e = evaluate(S.pose, S.st, S.t, true), j = e.body.j, P = S.pose;
  const xyz = (v: V3) => v.map(r4);
  return {
    preset: P.preset, timeline: r4(e.s), phase: e.phase,
    serverPosition: [P.px, P.py, P.hipH], ball: xyz(e.ball), releasePoint: xyz(e.tz.R), contactPoint: xyz(e.tz.C),
    freeHand: xyz(j.freeHand), freeElbow: xyz(j.freeElbow), freeShoulder: xyz(j.freeShoulder), head: xyz(j.head),
    racketHand: xyz(j.racketHand), racketShoulder: xyz(j.racketShoulder),
    torsoYaw: P.yaw, torsoLean: P.lean, shoulderRotation: P.twist, headLean: P.headFlex, headLateral: P.headLat,
    backwardToss: P.backToss, tossLaunchAngleDeg: r4(e.tz.launch), tossChordAngleDeg: r4(e.tz.chord),
    leftEyeVisibility: eyeText(e.eyes[0]), rightEyeVisibility: eyeText(e.eyes[1]), centerEyeVisibility: eyeText(e.eyes[2]),
    hiddenUnderCriterion: e.hidden, hiddenBy: e.hiddenBy,
    freeArmLegal: e.legal, freeArmMinClearance_m: r4(e.armMin + S.st.margin), requiredClearance_m: S.st.margin,
    deltaBallMinusFreeHand_m: r4(e.delta), serverGazeDeg: r4(e.gaze.angle), poseIssues: e.issues,
    settings: S.st, params: P,
  };
}
// Pose JSON dialog: opens with the current pose selected, so a paste replaces it and typing edits it.
const dlg = $('json-dlg') as HTMLDialogElement, jsonText = $('json-text') as HTMLTextAreaElement, jsonMsg = $('json-msg');
const jsonLoad = $('json-load') as HTMLButtonElement;
/** Accepts a "Copy pose JSON" object (its params + settings) or a bare parameter object; unknown or mistyped keys are ignored. */
function parsePose(txt: string): { p?: Partial<Pose>; st?: Partial<Settings>; err?: string } {
  let o: any;
  try { o = JSON.parse(txt); } catch (e) { return { err: L('invalid JSON: ', 'JSON 格式错误：') + (e as Error).message }; }
  const pick = (from: any, ref: object) => Object.fromEntries(Object.entries(from ?? {}).filter(([k, v]) => k in ref && typeof v === typeof (ref as any)[k]));
  const p = pick(o?.params ?? o, S.pose) as Partial<Pose>;
  if (!Object.keys(p).some((k) => k !== 'preset')) return { err: L('no pose parameters found — expected "params" or keys such as px, py, yaw', '没有找到姿态参数——需要 "params"，或 px、py、yaw 等字段') };
  return { p, st: o?.settings ? (pick(o.settings, S.st) as Partial<Settings>) : undefined };
}
function checkJSON() {
  const r = parsePose(jsonText.value), n = Object.keys(r.p ?? {}).length;
  jsonLoad.disabled = !!r.err;
  jsonMsg.className = r.err ? 'bad' : 'ok';
  jsonMsg.textContent = r.err ? `✗ ${r.err}` : `✓ ${L(`${n} pose parameters`, `${n} 个姿态参数`)}${r.st ? L(' + settings', ' + 设置') : ''}`;
}
function openJSON() {
  jsonText.value = JSON.stringify({ params: S.pose, settings: S.st }, null, 2); // only what loading uses, so every edit takes effect
  checkJSON();
  dlg.showModal();
  jsonText.focus();
  jsonText.select();
  jsonText.scrollTop = 0;
}
jsonText.oninput = checkJSON;
jsonText.onkeydown = (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && !jsonLoad.disabled) jsonLoad.click(); };
jsonLoad.onclick = () => {
  const r = parsePose(jsonText.value);
  if (r.err) return;
  loadPose({ ...S.pose, ...r.p }, null, undefined, r.st as Settings | undefined);
  dlg.close();
};
$('json-cancel').onclick = () => dlg.close();
dlg.onclick = (ev) => { if (ev.target === dlg) dlg.close(); }; // click on the backdrop
$('json-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(jsonText.value); jsonMsg.className = 'ok'; jsonMsg.textContent = L('Copied ✓', '已复制 ✓'); } catch { jsonText.select(); }
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(JSON.stringify(poseJSON(), null, 2)); } catch { openJSON(); return; } // no clipboard access: show it instead
  $('copy').textContent = L('Copied ✓', '已复制 ✓');
  setTimeout(applyStatic, 1500);
};
$('paste').onclick = openJSON;

// ------------------------------------------------------------------------------------------- searches (web worker)
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const results = $('results');
let lastFound: Found[] = [];
let lastMsg: any = null;
const busy = (on: boolean) => ['search', 'sweep', 'compare'].forEach((id) => (($(id) as HTMLButtonElement).disabled = on));
function run(kind: 'search' | 'sweep' | 'compare') {
  busy(true);
  lastMsg = null;
  results.innerHTML = `<span class="dim">${L('running… (seeded, deterministic)', '运行中……（固定随机种子，可复现）')}</span>`;
  worker.postMessage({ kind, st: { ...S.st }, pose: { ...S.pose }, scope: ($('scope') as HTMLSelectElement).value, behind: ($('behind') as HTMLInputElement).checked, whole: ($('whole') as HTMLInputElement).checked });
}
$('search').onclick = () => run('search');
$('sweep').onclick = () => run('sweep');
$('compare').onclick = () => run('compare');

const cell = (f: Found) => {
  const i = lastFound.push(f) - 1, m = f.margin;
  const tip = L(`obstruction depth ${cm(f.occ)}, free-arm clearance ${cm(f.clr + S.st.margin)}`, `遮挡深度 ${cm(f.occ)}，非持拍臂净空 ${cm(f.clr + S.st.margin)}`) +
    (f.found ? '' : L(' — best attempt', ' — 最佳尝试') + (Math.min(f.occ, f.clr) > 0 ? L(' (violates a realism constraint)', '（违反了现实约束）') : ''));
  return `<td class="click ${f.found ? 'yes' : 'no'}" data-i="${i}" title="${tip}">${f.found ? (m >= 0.01 ? L('✔ found', '✔ 找到') : L('≈ marginal', '≈ 临界')) : L('✖ none', '✖ 未找到')}<br>${cm(m)}</td>`;
};
results.onclick = (ev) => {
  const td = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (!td) return;
  const f = lastFound[+td.dataset.i!];
  loadPose({ ...f.pose }, f.target);
};
const scopeLabel = (s: string) => ({
  typical: L('all serve types · typical ranges', '所有发球 · 一般范围'), common: L('all serve types · common low-serve envelope', '所有发球 · 常见低发球范围'),
  extended: L('all serve types · extended ranges', '所有发球 · 扩展范围'), family: L('current preset family', '当前预设附近'),
} as Record<string, string>)[s];
const envLabel = (s: string) => ({ typical: L('typical', '一般'), common: L('common low-serve', '常见低发球'), extended: L('extended', '扩展') } as Record<string, string>)[s] ?? s;
const note = () => `<div class="note">${L(
  '✔ = a pose satisfying 2.6.5 (with the required clearance) while the target part hides the ball under the current criterion · ≈ marginal = less than 1 cm to spare · value = min(obstruction depth, free-arm clearance); negative = how far the best attempt is from a counterexample · ✖ = no counterexample was found within the modeled parameter range. Click a cell to load the pose.',
  '✔ = 找到符合 2.6.5（含要求的净空）且目标部位按当前判据挡住球的姿态 · ≈ 临界 = 余量不足 1 cm · 数值 = min(遮挡深度, 非持拍臂净空)；负数 = 最佳尝试离反例还差多少 · ✖ = 在模型参数范围内未找到反例。点击格子载入姿态。')}</div>`;
const trProgress = (s: string) => lang !== 'zh' ? s : s
  .replace(/^Case (\w+): (\w+)…$/, (_, id, t) => `案例 ${id}：${catName(t)}……`)
  .replace(/^δ = (\d+) cm · (\w+) done$/, (_, d, t) => `δ = ${d} cm · ${catName(t)} 完成`)
  .replace(/^(.+) done$/, (_, x) => `${tr(x)} 完成`);
function renderResults() {
  const m = lastMsg;
  if (!m) return;
  lastFound = [];
  if (m.kind === 'search') {
    results.innerHTML = `<span class="title">${L('Counterexample search', '反例搜索')}</span>${m.behind ? ` <span class="warn">${L('+ hypothesis B (Δ > 0)', '+ 假设 B（Δ > 0）')}</span>` : ''}${m.whole ? ` <span class="warn">${L('+ 2.6.5 over the whole toss', '+ 整个抛球过程符合 2.6.5')}</span>` : ''} <span class="dim">(${scopeLabel(m.scope)})</span>` +
      `<table><tr><th>${L('case', '案例')}</th><th>${L('condition', '条件')}</th><th>${L('result', '结果')}</th><th>δ</th><th>${L('contact z', '击球高度')}</th></tr>` +
      (m.out as (Found & { id: string; title: string })[]).map((f) => `<tr><td>${f.id}</td><td style="text-align:left">${tr(f.title)}</td>${cell(f)}<td>${(f.pose.backToss * 100).toFixed(0)} cm</td><td>${f.pose.contactZ.toFixed(2)} m</td></tr>`).join('') + '</table>' + note();
  } else if (m.kind === 'sweep') {
    const out = m.out as SweepCell[];
    results.innerHTML = `<span class="title">${L('Backward-toss sweep', '回抛扫描')}</span> <span class="dim">(${L('hook-serve family', '勾手发球附近')} · ${envLabel(m.scope)})</span><table><tr><th></th>${SWEEP_D.map((d) => `<th>${(d * 100).toFixed(0)} cm</th>`).join('')}</tr>` +
      SWEEP_TARGETS.map((t) => `<tr><th>${catName(t)}</th>${SWEEP_D.map((d) => cell(out.find((c) => c.d === d && c.target === t)!)).join('')}</tr>`).join('') +
      `<tr><th class="dim">${L('launch°', '出手角')}</th>${SWEEP_D.map((d) => { const f = out.find((c) => c.d === d)!; return `<td class="dim">${evaluate(f.pose, S.st).tz.launch.toFixed(1)}°</td>`; }).join('')}</tr></table>` +
      sweepChart(out) + note();
  } else {
    const rows = m.out as CompareRow[];
    results.innerHTML = `<span class="title">${L('Preset comparison', '预设比较')}</span> <span class="dim">(${L('each preset ± its family ranges', '每个预设附近')} · ${envLabel(m.scope)})</span>` +
      `<table><tr><th>${L('preset', '预设')}</th><th>${L('2.6.5 as defined', '2.6.5（预设原样）')}</th>` + SWEEP_TARGETS.map((t) => `<th>${catName(t)}</th>`).join('') + '</tr>' +
      rows.map((r) => `<tr><td style="text-align:left">${tr(r.label)}</td><td class="${r.nominalLegal ? 'no' : 'yes'}">${r.nominalLegal ? L('LEGAL', '合法') : L('ILLEGAL', '违规')}<br>${cm(r.nominalClr + S.st.margin)}</td>${r.results.map(cell).join('')}</tr>`).join('') + '</table>' + note();
  }
}
worker.onmessage = (ev) => {
  const m = ev.data;
  if (m.kind === 'progress') { results.innerHTML = `<span class="dim">${trProgress(m.text)}</span>`; return; }
  busy(false);
  lastMsg = m;
  renderResults();
  if (m.kind === 'search') { const first = (m.out as Found[]).find((f) => f.found); if (first) loadPose({ ...first.pose }, first.target); }
};

/** Best max-min margin vs δ for each target (3 series, validated dark palette, legend + direct labels). */
function sweepChart(out: SweepCell[]) {
  const W = 400, H = 170, Lp = 40, R = 70, T = 12, B = 26;
  const COL: Record<string, string> = { head: '#3987e5', shoulder: '#d95926', torso: '#199e70' };
  const val = (c: SweepCell) => c.margin * 100;
  const vals = out.map(val), lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const x = (d: number) => Lp + (d / SWEEP_D[SWEEP_D.length - 1]) * (W - Lp - R), y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const series = SWEEP_TARGETS.map((t) => {
    const pts = out.filter((c) => c.target === t);
    const last = pts[pts.length - 1];
    return `<polyline fill="none" stroke="${COL[t]}" stroke-width="2" points="${pts.map((c) => `${x(c.d)},${y(val(c))}`).join(' ')}"/>` +
      pts.map((c) => `<circle cx="${x(c.d)}" cy="${y(val(c))}" r="4" fill="${COL[t]}" stroke="#171b21" stroke-width="2"><title>${catName(t)}, δ=${(c.d * 100).toFixed(0)} cm: ${val(c).toFixed(1)} cm (${c.found ? L('counterexample', '反例') : L('none found', '未找到')})</title></circle>`).join('') +
      `<text x="${x(last.d) + 8}" y="${y(val(last)) + 4}" fill="#dde2e8" font-size="11">${catName(t)}</text>`;
  }).join('');
  const ticks = SWEEP_D.map((d) => `<text x="${x(d)}" y="${H - 8}" fill="#8b95a3" font-size="10" text-anchor="middle">${(d * 100).toFixed(0)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${L('Best margin versus backward toss displacement', '最佳余量随回抛距离的变化')}">
    <line x1="${Lp}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#8b95a3" stroke-dasharray="3 3"/>
    <text x="${Lp - 4}" y="${y(0) + 3}" fill="#8b95a3" font-size="10" text-anchor="end">0</text>
    <text x="${Lp - 4}" y="${y(hi) + 8}" fill="#8b95a3" font-size="10" text-anchor="end">${hi.toFixed(0)}</text>
    <text x="${Lp - 4}" y="${y(lo)}" fill="#8b95a3" font-size="10" text-anchor="end">${lo.toFixed(0)}</text>
    ${ticks}<text x="${(Lp + W - R) / 2}" y="${H}" fill="#8b95a3" font-size="10" text-anchor="middle">${L('backward displacement δ (cm) · y: best margin (cm), > 0 ⇒ counterexample', '回抛距离 δ（cm）· 纵轴：最佳余量（cm），> 0 即为反例')}</text>${series}</svg>`;
}

// ------------------------------------------------------------------------------------------- language
const LEGEND: [string, string, string][] = [
  ['#3b82f6', 'free arm', '非持拍臂'], ['#ff2d2d', 'free arm inside the 2.6.5 volume', '非持拍臂进入 2.6.5 空间'], ['#22a06b', 'racket arm', '持拍臂'],
  ['#ffd400', 'part hiding the ball', '挡住球的部位'], ['rgba(255,42,42,.45)', '2.6.5 volume', '2.6.5 空间'], ['#3ccf7a', 'sight line: visible', '视线：可见'],
  ['#ff5a52', 'sight line: blocked', '视线：被挡'], ['#ff8c1a', 'ball', '球'],
];
function applyStatic() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = L('Hidden Serve Geometry', '发球遮挡几何实验');
  const set = (id: string, en: string, zh: string) => ($(id).textContent = L(en, zh));
  set('brand', 'Hidden-serve geometry lab', '发球遮挡几何实验');
  set('about', 'Rules & purpose', '规则与目标');
  set('intro-title', 'What does this simulator test?', '这个模拟器在验证什么？');
  set('intro-question', 'Can the ball still be hidden by other body parts after the free arm has left the required space?',
    '非持拍臂完全移出规定空间后，球还能被身体其他部位挡住吗？');
  set('intro-arm-title', '2.6.5 · Remove the entire free arm and hand', '2.6.5 · 整个非持拍臂及手必须退出');
  set('intro-arm', 'As soon as the ball is tossed, the entire non-racket arm and hand must be removed from the space between the ball and the net. Moving only the hand is not enough.',
    '球一抛出，整个非持拍臂（上臂、前臂）及手就必须移出球与球网之间的规定空间。只移开手掌还不够。');
  set('intro-space', 'In this model, the space looks triangular from above, joining the ball to both ends of the net. It is a 3D volume that includes the net’s unlimited upward extension, shown in red.',
    '本模型中，这个空间俯视呈三角形，由球和球网两端界定；实际是包含球网无限向上延伸的三维空间，在图中以红色表示。');
  set('intro-visibility-title', '2.6.4 · The ball must remain visible to the receiver', '2.6.4 · 球必须始终对接发球员可见');
  set('intro-visibility', 'From the start of service until contact, the server, doubles partner, and anything they wear or carry must not hide the ball from the receiver. Clearing the free arm does not automatically satisfy this separate requirement.',
    '从发球开始到击球，发球员、双打搭档及其穿戴或携带的物品都不能遮住接发球员看球的视线。非持拍臂退出空间，不代表头、躯干或持拍臂也不会遮挡球。');
  set('intro-model', 'This independent geometric model is based on ITTF Laws 2.6.4 and 2.6.5, with adjustable boundary and visibility assumptions. It is not an official ITTF ruling. The initial view checks contact; use the timeline and whole-toss search to examine the motion.',
    '本工具依据 ITTF 2.6.4 / 2.6.5 建立可检查的几何模型，空间边界与可见性判据可调，并非 ITTF 官方判罚工具。初始画面检查击球瞬间；可结合时间轴和全过程搜索查看发球过程。');
  set('intro-source', 'Read ITTF Statutes 2026 · Laws 2.6.4 / 2.6.5', '查看 ITTF 2026 规则原文 · 2.6.4 / 2.6.5');
  set('intro-start', 'Explore the simulator', '开始探索');
  set('intro-lang', '中文', 'English');
  set('reset', '↺ Reset', '↺ 重置');
  $('reset').title = L('Back to the default pose (backhand corner, game position)', '恢复默认姿态（反手位、比赛站位）');
  set('tl0', 'release', '出手'); set('tl1', 'contact', '击球');
  set('h-search', 'Search', '搜索'); set('search', 'Search counterexample', '搜索反例'); set('sweep', 'Backward-toss sweep', '回抛扫描'); set('compare', 'Compare presets', '比较预设');
  set('l-scope', 'Scope', '范围'); set('l-behind', 'require Δ > 0 (ball behind free hand)', '要求 Δ > 0（球在非持拍手后方）'); set('l-whole', '2.6.5 over the whole toss', '整个抛球过程都符合 2.6.5');
  set('h-presets', 'Serve preset', '发球预设'); set('h-pose', 'Pose', '姿态'); set('copy', 'Copy pose JSON', '复制姿态 JSON'); set('paste', 'Load / edit pose JSON', '载入 / 编辑姿态 JSON');
  set('json-title', 'Pose JSON', '姿态 JSON');
  set('json-hint', 'Paste a pose (from “Copy pose JSON”, the README or results/experiments.json) or edit the current parameters below. Only params and settings are loaded; ⌘/Ctrl + Enter loads, Esc closes.',
    '粘贴一个姿态（来自“复制姿态 JSON”、README 或 results/experiments.json），或直接修改下面的当前参数。只载入 params 和 settings；⌘/Ctrl + Enter 载入，Esc 关闭。');
  set('json-copy', 'Copy', '复制'); set('json-cancel', 'Cancel', '取消'); set('json-load', 'Load', '载入');
  $('lang').textContent = lang === 'zh' ? 'EN' : '中文';
  $('lang').title = L('切换到中文', 'Switch to English');
  $('whole').parentElement!.title = L('Free arm must stay outside the 2.6.5 volume from 10 % of the toss (≈ 50 ms after release) until contact. Slower (~1 min).', '从出手后 10 %（约 50 ms）起直到击球，非持拍臂都必须在 2.6.5 空间外。较慢（约 1 分钟）。');
  $('behind').parentElement!.title = L('Hypothesis B: contact point behind the free hand along the receiver sight line', '假设 B：沿接发者视线，击球点在非持拍手后方');
  const views: Record<string, [string, string]> = { '3d': ['3D', '3D'], receiver: ['Receiver view', '接发者视角'], overhead: ['Overhead', '俯视'], side: ['Side', '侧视'] };
  document.querySelectorAll<HTMLButtonElement>('#views [data-view]').forEach((b) => (b.textContent = L(...views[b.dataset.view!])));
  ($('scope') as HTMLSelectElement).querySelectorAll('option').forEach((o) => (o.textContent = scopeLabel(o.value)));
  $('legend').innerHTML = LEGEND.map(([c, en, zh]) => `<span><i style="background:${c}"></i>${L(en, zh)}</span>`).join('');
  insetLabels.forEach((d, i) => (d.textContent = L(['RECEIVER', 'OVERHEAD', 'SIDE'][i], ['接发者视角', '俯视', '侧视'][i])));
  eyeLabels.forEach((o, i) => (o.element.textContent = L(['L eye', 'R eye'][i], ['左眼', '右眼'][i])));
  coordY.textContent = L('Y (→ receiver)', 'Y（→ 接发者）');
  for (const [, [o, en]] of jointLabels) o.element.textContent = tr(en);
}
function applyLanguage() {
  applyStatic();
  buildGui();
  renderPresets();
  renderResults();
  update();
}
$('reset').onclick = () => loadPose({ ...PRESETS.backhand.pose }, null, 'backhand');
$('lang').onclick = () => { setLang(lang === 'zh' ? 'en' : 'zh'); applyLanguage(); };
$('intro-lang').onclick = $('lang').onclick;
const intro = $('intro-dlg') as HTMLDialogElement;
$('about').onclick = () => intro.showModal();

applyStatic();
buildGui();
renderPresets();
update();
render();
intro.showModal();
Object.assign(window, { S, update, loadPose, poseJSON, setView, cam, controls, applyLanguage, setLang }); // console access for reproducibility
