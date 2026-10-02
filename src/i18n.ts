// English ⇄ 中文. `L(en, zh)` for inline text, `tr(en)` for labels defined elsewhere (parts, presets, controls),
// `trIssue` for pose-check messages. The chosen language is a per-viewer convenience kept in localStorage.
export type Lang = 'en' | 'zh';
export let lang: Lang = (() => { try { return localStorage.getItem('lang') === 'zh' ? 'zh' : 'en'; } catch { return 'en'; } })();
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch { /* private mode: ignore */ }
}
export const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);

const ZH: Record<string, string> = {
  // body parts / joints
  head: '头', neck: '颈', torso: '躯干', 'torso (pelvis)': '躯干（骨盆）', thigh: '大腿', shin: '小腿',
  'free-side shoulder (trapezius)': '非持拍侧肩（斜方肌）', 'racket-side shoulder (trapezius)': '持拍侧肩（斜方肌）',
  'free shoulder (deltoid)': '非持拍肩（三角肌）', 'racket shoulder (deltoid)': '持拍肩（三角肌）',
  'free upper arm': '非持拍上臂', 'free forearm': '非持拍前臂', 'free hand': '非持拍手', 'free elbow': '非持拍肘', 'free shoulder': '非持拍肩', 'free wrist': '非持拍手腕',
  'racket upper arm': '持拍上臂', 'racket forearm': '持拍前臂', 'racket hand': '持拍手', 'racket shoulder': '持拍肩', 'racket elbow': '持拍肘', 'racket wrist': '持拍手腕',
  'racket handle': '拍柄', 'racket blade': '拍面', 'racket blade edge': '拍面边缘', 'racket grip': '握拍处',
  // categories
  shoulder: '肩', 'free arm': '非持拍臂', 'racket arm': '持拍臂', racket: '球拍', leg: '腿', 'free-side shoulder': '非持拍侧肩', 'racket-side shoulder': '持拍侧肩', 'any body part': '身体任意部位',
  // presets and cases
  'Backhand corner / side-on': '反手位侧身', Middle: '中路', 'Forehand side': '正手位', 'Hook — vertical toss': '勾手 · 竖直抛球', 'Hook — backward toss': '勾手 · 回抛',
  '2.6.5 compliant AND ball hidden by torso': '符合 2.6.5，且躯干挡住球', '2.6.5 compliant AND ball hidden by shoulder': '符合 2.6.5，且肩挡住球',
  '… by the free-side shoulder': '……由非持拍侧肩挡住', '… by the racket-side shoulder': '……由持拍侧肩挡住',
  '2.6.5 compliant AND ball hidden by head': '符合 2.6.5，且头挡住球', '2.6.5 compliant AND ball hidden by racket arm': '符合 2.6.5，且持拍臂挡住球',
  // timeline phases
  release: '出手', rising: '上升', apex: '最高点', falling: '下落', contact: '击球',
  // GUI
  Controls: '控制', TOSS: '抛球', BODY: '身体', 'RACKET ARM': '持拍臂', RECEIVER: '接发球员', 'RULE MODEL (experiment parameters)': '规则模型（实验参数）', DEBUG: '显示',
  'Toss backward displacement (m)': '回抛距离 δ（m）', 'Drift direction (° from straight back)': '回抛方向（°，0 = 正后方）', 'Toss rise (m, ≥ 0.16)': '抛起高度（m，≥ 0.16）',
  'Release: in front of hips (m)': '出手点：髋前距离（m）', 'Release: lateral (m, + right)': '出手点：横向（m，+ 向右）', 'Release height (m)': '出手高度（m）', 'Contact height (m)': '击球高度（m）',
  'Server X (m)': '站位 X（m）', 'Server Y (m)': '站位 Y（m）', 'Hip height (m)': '髋高（m）', 'Torso yaw (°)': '躯干朝向（°）', 'Torso lean (°)': '躯干前倾（°）', 'Torso side lean (°)': '躯干侧倾（°）',
  'Shoulder rotation (°)': '肩线扭转（°）', 'Head lean (°)': '低头（°）', 'Head lateral (°)': '头侧倾（°）', 'Free elbow swivel (°)': '非持拍肘外展（°）',
  'Free hand → right (m)': '非持拍手 → 右（m）', 'Free hand → forward (m)': '非持拍手 → 前（m）', 'Free hand → up (m)': '非持拍手 → 上（m）',
  'Face azimuth (°)': '拍面方位角（°）', 'Face elevation (°)': '拍面仰角（°）', 'Handle roll (°)': '拍柄滚转（°）', 'Racket elbow swivel (°)': '持拍肘外展（°）',
  'Receiver X (m)': '接发者 X（m）', 'Eyes behind own end line (m)': '眼睛在本方端线后（m）', 'Eye height (m)': '眼高（m）', 'Eye spacing (m)': '瞳距（m）',
  'Visibility criterion': '可见性判据', 'Whole ball must be hidden': '要求整个球被挡住', '2.6.5 net span': '2.6.5 网的横向范围', '2.6.5 lower boundary': '2.6.5 下边界',
  'Required free-arm clearance (m)': '非持拍臂最小净空（m）',
  'both eyes blocked': '双眼都被挡', 'either eye blocked': '任一只眼被挡', 'centre-eye approximation': '中心眼近似',
  'net incl. posts (±0.915 m)': '含网柱（±0.915 m）', 'net between posts (±0.895 m)': '网柱之间（±0.895 m）', 'table sidelines (±0.7625 m)': '只到边线（±0.7625 m）',
  'convex hull, net from playing surface (literal)': '凸包：网从台面算起（字面）', 'hull from net top only (lenient)': '凸包：只从网顶算起（宽松）',
  'vertical prism above playing surface (strict)': '竖直棱柱：台面以上全部（严格）',
  'Show 2.6.5 volume': '显示 2.6.5 空间', 'Show eye rays': '显示视线', 'Show skeleton': '显示骨架', 'Show coordinates': '显示坐标轴', 'Show toss trajectory': '显示抛球轨迹',
  'Show hidden ball': '显示被挡住的球', 'Show labels': '显示标签', 'Show inset views': '显示小窗视图', 'Show TTR 30° cone': '显示 TTR 30° 锥',
};
export const tr = (en: string) => (lang === 'zh' ? ZH[en] ?? en : en);

const ISSUES: [RegExp, (...g: string[]) => string][] = [
  [/^free hand target out of reach$/, () => '非持拍手目标位置够不到'],
  [/^racket cannot reach the ball$/, () => '球拍够不到球'],
  [/^racket face does not push the ball towards the receiver$/, () => '拍面没有把球推向接发球员'],
  [/^racket wrist bent (\d+)° \(> 100°\)$/, (a) => `持拍手腕弯折 ${a}°（> 100°）`],
  [/^contact point not behind the end line$/, () => '击球点不在端线后'],
  [/^contact point below the playing surface$/, () => '击球点低于台面'],
  [/^release point not behind the end line$/, () => '出手点不在端线后'],
  [/^release point below the playing surface$/, () => '出手点低于台面'],
  [/^ball not falling at contact$/, () => '击球时球不在下落'],
  [/^toss rises < 16 cm$/, () => '抛起不足 16 cm'],
  [/^release point out of the free hand’s reach$/, () => '出手点超出非持拍手可及范围'],
  [/^(.+) touches the table$/, (a) => `${tr(a)}碰到了球台`],
  [/^ball touches (.+)$/, (a) => `球碰到了${tr(a)}`],
  [/^server's own (.+) blocks the server's view of the ball$/, (a) => `发球员自己的${tr(a)}挡住了看球的视线`],
  [/^server cannot watch the ball \((\d+)° off the face direction\)$/, (a) => `发球员无法看着球（偏离面部朝向 ${a}°）`],
  [/^(.+) inside (.+)$/, (a, b) => `${tr(a)}穿入了${tr(b)}`],
];
export function trIssue(s: string) {
  if (lang !== 'zh') return s;
  for (const [re, f] of ISSUES) { const m = s.match(re); if (m) return f(...m.slice(1)); }
  return s;
}
