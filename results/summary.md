## 1. Presets (nominal poses, default settings)

| preset | ball at contact (m) | toss δ / launch | 2.6.5 free arm (min clearance) | free arm out of volume from | ball hidden at contact | ball hidden during toss | Δ ball−free hand |
|---|---|---|---|---|---|---|---|
| Backhand corner / side-on | (-0.77, -1.44, 0.92) | 0 cm / 0.0° | LEGAL (+6.0 cm) | t = 20 % | no | 0/61 frames | -1.8 cm |
| Middle | (-0.00, -1.42, 0.92) | 0 cm / 0.0° | LEGAL (+10.2 cm) | t = 2 % | no | 0/61 frames | -19.0 cm |
| Forehand side | (0.71, -1.45, 0.92) | 0 cm / 0.0° | LEGAL (+12.5 cm) | t = 18 % | no | 0/61 frames | -1.8 cm |
| Hook — vertical toss | (-0.51, -1.46, 1.00) | 0 cm / 0.0° | LEGAL (+12.8 cm) | t = 2 % | no | 0/61 frames | -3.4 cm |
| Hook — backward toss | (-0.71, -1.48, 1.00) | 20 cm / 9.5° | **ILLEGAL** (-3.2 cm) | never (in volume at contact) | no | 16/61 frames | -1.4 cm |

## 2a. Counterexample search — all serve types, TYPICAL ranges

| case | condition | result: min(obstruction depth, free-arm clearance) cm | obstruction / clearance cm | pose | evaluations |
|---|---|---|---|---|---|
| A | 2.6.5 compliant AND ball hidden by torso | **FOUND** +11.1 | +11.1 / +13.1 | yaw -98°, lean 33°, side 10°, twist -30°, neck flex 41°, neck lat 5°, contact (0.95, -1.92, 1.04) m, δ 10 cm | 11057 (1 seed) |
| B | 2.6.5 compliant AND ball hidden by shoulder | **FOUND** +1.9 | +1.9 / +3.9 | yaw 60°, lean 45°, side -2°, twist 30°, neck flex 44°, neck lat -7°, contact (-0.95, -1.60, 1.04) m, δ 7 cm | 11057 (1 seed) |
| B1 | … by the free-side shoulder | none (-1.7) | -1.7 / +0.3 | yaw -105°, lean 43°, side -7°, twist -30°, neck flex 37°, neck lat 6°, contact (0.95, -1.93, 1.10) m, δ 15 cm | 101076 (4 seeds) |
| B2 | … by the racket-side shoulder | marginal +0.2 | +0.2 / +5.3 | yaw 60°, lean 42°, side -7°, twist 30°, neck flex 34°, neck lat -11°, contact (-0.94, -1.94, 1.09) m, δ 7 cm | 11004 (1 seed) |
| C | 2.6.5 compliant AND ball hidden by head | **FOUND** +5.5 | +5.5 / +7.5 | yaw 60°, lean 45°, side 10°, twist 30°, neck flex 44°, neck lat 20°, contact (-0.95, -1.55, 1.10) m, δ 0 cm | 11060 (1 seed) |
| D | 2.6.5 compliant AND ball hidden by racket arm | **FOUND** +4.3 | +4.3 / +16.0 | yaw 60°, lean 45°, side 2°, twist 30°, neck flex 40°, neck lat -20°, contact (-0.65, -1.84, 1.02) m, δ 15 cm | 11025 (1 seed) |

## 2b. Counterexample search — all serve types, COMMON envelope (contact ≤ 1.00 m, lean ≤ 35°, neck flexion ≤ 35°)

| case | condition | result: min(obstruction depth, free-arm clearance) cm | obstruction / clearance cm | pose | evaluations |
|---|---|---|---|---|---|
| A | 2.6.5 compliant AND ball hidden by torso | **FOUND** +10.8 | +10.8 / +23.0 | yaw -105°, lean 35°, side 7°, twist -15°, neck flex 35°, neck lat -20°, contact (0.92, -1.88, 0.80) m, δ 23 cm | 11058 (1 seed) |
| B | 2.6.5 compliant AND ball hidden by shoulder | none (-3.6) | -3.6 / -1.6 | yaw 60°, lean 35°, side 10°, twist 30°, neck flex 32°, neck lat 1°, contact (-0.95, -1.52, 1.00) m, δ 10 cm | 101232 (4 seeds) |
| B1 | … by the free-side shoulder | none (-6.6) | -6.6 / -4.6 | yaw -101°, lean 35°, side -10°, twist -30°, neck flex 34°, neck lat 12°, contact (0.95, -1.76, 1.00) m, δ 18 cm | 101080 (4 seeds) |
| B2 | … by the racket-side shoulder | none (-3.7) | -3.7 / -1.7 | yaw 60°, lean 35°, side 10°, twist 30°, neck flex 29°, neck lat -19°, contact (-0.94, -1.57, 1.00) m, δ 11 cm | 101020 (4 seeds) |
| C | 2.6.5 compliant AND ball hidden by head | none (-8.4) | -8.4 / -6.4 | yaw -81°, lean 35°, side -10°, twist -14°, neck flex 35°, neck lat -20°, contact (-0.60, -1.79, 1.00) m, δ 30 cm | 101240 (4 seeds) |
| D | 2.6.5 compliant AND ball hidden by racket arm | **FOUND** +4.3 | +4.3 / +7.3 | yaw 60°, lean 35°, side 10°, twist 30°, neck flex 35°, neck lat -14°, contact (-0.90, -1.83, 0.98) m, δ 21 cm | 11026 (1 seed) |

## 2c. Counterexample search — all serve types, EXTENDED ranges (no contact-zone constraint)

| case | condition | result: min(obstruction depth, free-arm clearance) cm | obstruction / clearance cm | pose | evaluations |
|---|---|---|---|---|---|
| A | 2.6.5 compliant AND ball hidden by torso | **FOUND** +11.4 | +11.4 / +13.5 | yaw -101°, lean 33°, side 10°, twist -30°, neck flex 41°, neck lat 6°, contact (0.99, -1.93, 1.04) m, δ 10 cm | 11059 (1 seed) |
| B | 2.6.5 compliant AND ball hidden by shoulder | **FOUND** +5.3 | +5.3 / +7.6 | yaw 65°, lean 42°, side 3°, twist 35°, neck flex 52°, neck lat 7°, contact (-1.39, -1.55, 1.06) m, δ 8 cm | 11059 (1 seed) |
| B1 | … by the free-side shoulder | **FOUND** +3.6 | +3.6 / +5.7 | yaw -110°, lean 35°, side 15°, twist -35°, neck flex 1°, neck lat 29°, contact (0.88, -2.34, 1.29) m, δ 7 cm | 11021 (1 seed) |
| B2 | … by the racket-side shoulder | **FOUND** +5.3 | +5.3 / +10.5 | yaw 70°, lean 42°, side -11°, twist 35°, neck flex 31°, neck lat -18°, contact (-1.09, -1.99, 1.12) m, δ 7 cm | 11006 (1 seed) |
| C | 2.6.5 compliant AND ball hidden by head | **FOUND** +7.1 | +7.1 / +9.1 | yaw 65°, lean 45°, side 11°, twist 35°, neck flex 48°, neck lat 23°, contact (-0.77, -1.79, 1.10) m, δ 4 cm | 11060 (1 seed) |
| D | 2.6.5 compliant AND ball hidden by racket arm | **FOUND** +4.4 | +4.4 / +25.3 | yaw 69°, lean 16°, side -10°, twist 30°, neck flex 23°, neck lat 12°, contact (-1.24, -1.87, 1.25) m, δ 3 cm | 11027 (1 seed) |

## 2d. Hypothesis A + B: free arm outside the volume AND ball behind the free hand (Δ > 0), typical ranges

| case | result: min(obstruction, clearance, Δ) cm | obstruction / clearance / Δ cm | pose |
|---|---|---|---|
| A torso | **FOUND** +11.3 | +11.3 / +13.3 / +11.6 | yaw -105°, lean 37°, side 10°, twist -30°, neck flex 24°, neck lat 11°, contact (0.92, -1.97, 1.02) m, δ 0 cm |
| B shoulder | marginal +0.6 | +0.6 / +2.6 / +8.0 | yaw 60°, lean 33°, side 6°, twist 30°, neck flex 44°, neck lat 6°, contact (-0.94, -1.54, 1.10) m, δ 8 cm |
| B1 shoulderFree | none (-1.5) | -1.5 / +0.5 / +3.5 | yaw -105°, lean 45°, side -6°, twist -30°, neck flex 42°, neck lat 13°, contact (0.95, -1.97, 1.10) m, δ 15 cm |
| B2 shoulderRacket | **FOUND** +1.6 | +1.6 / +3.6 / +4.9 | yaw 60°, lean 42°, side -6°, twist 30°, neck flex 45°, neck lat -12°, contact (-0.95, -1.90, 1.09) m, δ 8 cm |
| C head | **FOUND** +5.3 | +5.3 / +7.3 / +10.7 | yaw 60°, lean 45°, side 10°, twist 30°, neck flex 45°, neck lat 18°, contact (-0.72, -1.79, 1.09) m, δ 8 cm |
| D racketArm | **FOUND** +4.3 | +4.3 / +6.4 / +5.0 | yaw 59°, lean 36°, side 5°, twist 2°, neck flex 19°, neck lat -16°, contact (-0.83, -1.92, 1.08) m, δ 15 cm |

## 3. Sensitivity to the rule-model choices (typical ranges)

| variant | head | shoulder | shoulderFree | torso | racketArm |
|---|---|---|---|---|---|
| default: both eyes, ball-centre ray, hull floor, net ±0.915, margin 2 cm | **FOUND** +5.5 | **FOUND** +2.0 | none (-1.4) | **FOUND** +11.4 | **FOUND** +4.3 |
| whole ball hidden from both eyes | **FOUND** +4.4 | marginal +0.8 | none (-2.4) | **FOUND** +10.0 | **FOUND** +2.9 |
| strict 2.6.5 volume: vertical prism above playing surface | **FOUND** +5.5 | **FOUND** +2.0 | none (-1.5) | **FOUND** +11.4 | **FOUND** +4.3 |
| either eye blocked | **FOUND** +5.6 | **FOUND** +2.3 | none (-1.2) | **FOUND** +11.5 | **FOUND** +4.5 |
| margin 0 (ball as a point) | **FOUND** +5.8 | **FOUND** +2.8 | none (-0.4) | **FOUND** +11.4 | **FOUND** +4.3 |
| net span = table sidelines ±0.7625 | **FOUND** +5.7 | **FOUND** +2.2 | none (-0.2) | **FOUND** +11.4 | **FOUND** +4.3 |

## 4. Receiver lateral position (typical ranges)

| receiver eye x | head | shoulder | shoulderFree | torso | racketArm |
|---|---|---|---|---|---|
| -0.4 m | **FOUND** +4.7 | marginal +0.6 | none (-2.0) | **FOUND** +11.1 | **FOUND** +4.4 |
| 0.0 m | **FOUND** +5.5 | **FOUND** +2.2 | none (-1.1) | **FOUND** +11.4 | **FOUND** +4.3 |
| 0.4 m | **FOUND** +6.2 | **FOUND** +3.8 | none (-0.2) | **FOUND** +11.4 | **FOUND** +4.4 |

## 5. Highest allowed contact point (typical joints, contact zone on)

| target | z ≤ 0.90 m | z ≤ 0.95 m | z ≤ 1.00 m | z ≤ 1.05 m | z ≤ 1.10 m | z ≤ 1.20 m |
|---|---|---|---|---|---|---|
| head | none (-4.1) | none (-1.3) | marginal +0.2 | **FOUND** +2.9 | **FOUND** +5.5 | **FOUND** +5.5 |
| shoulder | none (-3.9) | none (-0.6) | marginal +0.3 | **FOUND** +2.3 | **FOUND** +2.4 | **FOUND** +2.4 |
| shoulderFree | none (-8.2) | none (-5.5) | none (-3.7) | none (-2.8) | none (-1.0) | marginal +0.9 |
| torso | **FOUND** +10.8 | **FOUND** +10.8 | **FOUND** +10.8 | **FOUND** +11.4 | **FOUND** +11.4 | **FOUND** +11.4 |
| racketArm | **FOUND** +4.3 | **FOUND** +4.3 | **FOUND** +4.3 | **FOUND** +4.3 | **FOUND** +4.3 | **FOUND** +4.3 |

## 5b. Highest allowed trunk lean (typical ranges otherwise)

| target | lean ≤ 20° | lean ≤ 25° | lean ≤ 30° | lean ≤ 35° | lean ≤ 40° | lean ≤ 45° |
|---|---|---|---|---|---|---|
| head | none (-8.8) | none (-6.1) | none (-3.4) | none (-0.5) | **FOUND** +2.6 | **FOUND** +5.5 |
| shoulder | none (-2.3) | none (-0.4) | marginal +1.0 | **FOUND** +1.5 | **FOUND** +2.2 | **FOUND** +2.4 |
| torso | **FOUND** +10.8 | **FOUND** +10.8 | **FOUND** +11.3 | **FOUND** +11.4 | **FOUND** +11.4 | **FOUND** +11.4 |
| racketArm | **FOUND** +4.3 | **FOUND** +4.3 | **FOUND** +4.4 | **FOUND** +4.4 | **FOUND** +4.4 | **FOUND** +4.4 |

## 5c. Highest allowed neck flexion — head target (typical ranges otherwise)

| target | neck flex ≤ 15° | neck flex ≤ 25° | neck flex ≤ 35° | neck flex ≤ 45° |
|---|---|---|---|---|
| head | none (-0.0) | **FOUND** +1.9 | **FOUND** +4.0 | **FOUND** +5.5 |

## 6a. Backward-toss sweep — hook family, TYPICAL envelope

| target | δ = 0 cm | δ = 5 cm | δ = 10 cm | δ = 15 cm | δ = 20 cm | δ = 30 cm | δ = 40 cm |
|---|---|---|---|---|---|---|---|
| head | **FOUND** +1.3 | marginal +0.4 | none (-0.1) | none (-0.6) | none (-1.2) | none (-2.4) | none (-3.4) |
| shoulder | none (-5.3) | none (-5.2) | none (-5.1) | none (-5.3) | none (-5.2) | none (-6.3) | none (-7.1) |
| torso | none (-2.0) | none (-2.0) | none (-0.6) | **FOUND** +1.3 | **FOUND** +3.5 | **FOUND** +3.5 | marginal +1.0 |
| toss angle (nominal hook toss, rise 30 cm): launch / chord | 0.0° / 0.0° | 2.4° / 4.8° | 4.8° / 9.5° | 7.1° / 14.0° | 9.5° / 18.4° | 14.0° / 26.6° | 18.4° / 33.7° |

## 6b. Backward-toss sweep — hook family, COMMON envelope (contact ≤ 1.00 m, lean ≤ 35°, neck flexion ≤ 35°)

| target | δ = 0 cm | δ = 5 cm | δ = 10 cm | δ = 15 cm | δ = 20 cm | δ = 30 cm | δ = 40 cm |
|---|---|---|---|---|---|---|---|
| head | none (-10.0) | none (-9.8) | none (-9.7) | none (-9.5) | none (-9.3) | none (-9.3) | none (-12.2) |
| shoulder | none (-9.1) | none (-9.1) | none (-9.0) | none (-9.0) | none (-9.1) | none (-9.1) | none (-9.8) |
| torso | none (-5.0) | none (-2.7) | none (-2.0) | none (-1.4) | marginal +0.2 | marginal +0.3 | marginal +0.5 |

## 6c. Backward-toss sweep — all serve types, TYPICAL envelope, δ fixed

| target | δ = 0 cm | δ = 10 cm | δ = 20 cm | δ = 30 cm |
|---|---|---|---|---|
| head | **FOUND** +5.5 | **FOUND** +5.1 | **FOUND** +3.7 | **FOUND** +2.3 |
| shoulder | **FOUND** +1.7 | **FOUND** +2.1 | **FOUND** +1.0 | marginal +0.6 |
| torso | **FOUND** +11.4 | **FOUND** +11.4 | **FOUND** +10.8 | **FOUND** +10.8 |

## 6d. Backward-toss sweep — all serve types, COMMON envelope, δ fixed

| target | δ = 0 cm | δ = 10 cm | δ = 20 cm | δ = 30 cm |
|---|---|---|---|---|
| head | none (-9.1) | none (-8.7) | none (-8.4) | none (-8.0) |
| shoulder | none (-3.6) | none (-3.6) | none (-3.7) | none (-3.7) |
| torso | **FOUND** +10.0 | **FOUND** +10.1 | **FOUND** +10.8 | **FOUND** +10.8 |

## 7a. Preset comparison — best attainable within each preset family, TYPICAL envelope

| preset | 2.6.5 nominal (clearance) | head | shoulder | torso |
|---|---|---|---|---|
| Backhand corner / side-on | LEGAL (+6.0) | none (-0.2) | none (-5.0) | none (-1.2) |
| Middle | LEGAL (+10.2) | none (-0.3) | none (-7.2) | none (-2.0) |
| Forehand side | LEGAL (+12.5) | none (-0.6) | none (-6.5) | none (-2.0) |
| Hook — vertical toss | LEGAL (+12.8) | **FOUND** +1.3 | none (-5.2) | none (-2.0) |
| Hook — backward toss | **ILLEGAL** (-3.2) | none (-1.2) | none (-5.1) | **FOUND** +3.5 |

## 7b. Preset comparison — best attainable within each preset family, COMMON envelope

| preset | 2.6.5 nominal (clearance) | head | shoulder | torso |
|---|---|---|---|---|
| Backhand corner / side-on | LEGAL (+6.0) | none (-10.4) | none (-8.5) | none (-2.0) |
| Middle | LEGAL (+10.2) | none (-10.4) | none (-9.5) | none (-2.0) |
| Forehand side | LEGAL (+12.5) | none (-10.8) | none (-9.6) | none (-3.5) |
| Hook — vertical toss | LEGAL (+12.8) | none (-10.0) | none (-9.1) | none (-5.0) |
| Hook — backward toss | **ILLEGAL** (-3.2) | none (-9.3) | none (-9.1) | marginal +0.2 |

## 8. Representative counterexample poses (typical ranges)

### Case C (head) — zone miss 0.000

```json
{
 "preset": "backhand:search-head",
 "serverPosition": [
  -0.4008,
  -1.593,
  0.8015
 ],
 "ball": [
  -0.9486,
  -1.5452,
  1.0998
 ],
 "releasePoint": [
  -0.9489,
  -1.545,
  0.9559
 ],
 "freeHand": [
  -0.5804,
  -1.7613,
  1.1054
 ],
 "freeElbow": [
  -0.924,
  -1.693,
  1.1444
 ],
 "freeShoulder": [
  -0.7034,
  -1.4982,
  1.2417
 ],
 "head": [
  -0.845,
  -1.2182,
  1.1577
 ],
 "torsoYaw": 60,
 "torsoLean": 45,
 "headLean": 44.16,
 "headLateral": 20,
 "backwardToss": 0.0004,
 "tossLaunchAngleDeg": 0.02,
 "leftEyeVisibility": "BLOCKED BY head",
 "rightEyeVisibility": "BLOCKED BY head",
 "hiddenBy": [
  "head"
 ],
 "freeArmLegal": true,
 "freeArmMinClearance_m": 0.0753,
 "deltaBallMinusFreeHand_m": -0.1101,
 "settings": {
  "recvX": 0,
  "recvDist": 0.55,
  "eyeH": 1.45,
  "ipd": 0.063,
  "criterion": "both",
  "wholeBall": false,
  "halfSpan": 0.9149999999999999,
  "floor": "hull",
  "margin": 0.02
 },
 "params": {
  "preset": "backhand:search-head",
  "px": -0.40083,
  "py": -1.59297,
  "hipH": 0.80151,
  "yaw": 60,
  "lean": 45,
  "sideLean": 10,
  "twist": 30,
  "headFlex": 44.15787,
  "headLat": 20,
  "fhX": -0.14643,
  "fhY": 0.06416,
  "fhZ": -0.22701,
  "freeSwivel": 87.10358,
  "racketAz": 47.32869,
  "racketEl": 57.59932,
  "racketRoll": 99.56305,
  "racketSwivel": 3.96719,
  "relFwd": 0.4986,
  "relLat": -0.23248,
  "relZ": 0.9559,
  "backToss": 0.00039,
  "tossAz": -6.27285,
  "apex": 0.3,
  "contactZ": 1.09975
 }
}
```

### Case B (shoulder) — zone miss 0.000

```json
{
 "preset": "backhand:search-shoulder",
 "serverPosition": [
  -0.5465,
  -1.6463,
  0.8055
 ],
 "ball": [
  -0.9497,
  -1.5996,
  1.0448
 ],
 "releasePoint": [
  -1.0201,
  -1.5987,
  0.9741
 ],
 "freeHand": [
  -0.9707,
  -2.2842,
  1.0314
 ],
 "freeElbow": [
  -0.9108,
  -1.9484,
  1.1206
 ],
 "freeShoulder": [
  -0.8882,
  -1.6581,
  1.2267
 ],
 "head": [
  -1.0851,
  -1.4753,
  1.1986
 ],
 "torsoYaw": 60,
 "torsoLean": 44.97,
 "headLean": 43.59,
 "headLateral": -7.49,
 "backwardToss": 0.0704,
 "tossLaunchAngleDeg": 3.58,
 "leftEyeVisibility": "BLOCKED BY racket shoulder (deltoid)",
 "rightEyeVisibility": "BLOCKED BY racket shoulder (deltoid)",
 "hiddenBy": [
  "shoulder",
  "racketArm"
 ],
 "freeArmLegal": true,
 "freeArmMinClearance_m": 0.0394,
 "deltaBallMinusFreeHand_m": -0.6638,
 "settings": {
  "recvX": 0,
  "recvDist": 0.55,
  "eyeH": 1.45,
  "ipd": 0.063,
  "criterion": "both",
  "wholeBall": false,
  "halfSpan": 0.9149999999999999,
  "floor": "hull",
  "margin": 0.02
 },
 "params": {
  "preset": "backhand:search-shoulder",
  "px": -0.5465,
  "py": -1.6463,
  "hipH": 0.80552,
  "yaw": 60,
  "lean": 44.97218,
  "sideLean": -2.35489,
  "twist": 30,
  "headFlex": 43.5939,
  "headLat": -7.49343,
  "fhX": -0.45566,
  "fhY": 0.23083,
  "fhZ": -0.25014,
  "freeSwivel": 45.34799,
  "racketAz": 45.1821,
  "racketEl": 56.92485,
  "racketRoll": 129.89562,
  "racketSwivel": -18.83356,
  "relFwd": 0.43392,
  "relLat": -0.19559,
  "relZ": 0.97409,
  "backToss": 0.07039,
  "tossAz": 29.25405,
  "apex": 0.3,
  "contactZ": 1.04482
 }
}
```

### Case A (torso) — zone miss 0.000

```json
{
 "preset": "backhand:search-torso",
 "serverPosition": [
  0.7437,
  -1.6506,
  0.8
 ],
 "ball": [
  0.9477,
  -1.9161,
  1.0399
 ],
 "releasePoint": [
  1.0486,
  -1.9241,
  0.9344
 ],
 "freeHand": [
  1.2876,
  -1.8335,
  0.6785
 ],
 "freeElbow": [
  1.3017,
  -1.602,
  0.944
 ],
 "freeShoulder": [
  1.1185,
  -1.6344,
  1.1919
 ],
 "head": [
  1.1641,
  -1.9145,
  1.2837
 ],
 "torsoYaw": -98.16,
 "torsoLean": 33.35,
 "headLean": 41.49,
 "headLateral": 5.18,
 "backwardToss": 0.1012,
 "tossLaunchAngleDeg": 5.34,
 "leftEyeVisibility": "BLOCKED BY torso",
 "rightEyeVisibility": "BLOCKED BY torso",
 "hiddenBy": [
  "torso"
 ],
 "freeArmLegal": true,
 "freeArmMinClearance_m": 0.1305,
 "deltaBallMinusFreeHand_m": -0.0387,
 "settings": {
  "recvX": 0,
  "recvDist": 0.55,
  "eyeH": 1.45,
  "ipd": 0.063,
  "criterion": "both",
  "wholeBall": false,
  "halfSpan": 0.9149999999999999,
  "floor": "hull",
  "margin": 0.02
 },
 "params": {
  "preset": "backhand:search-torso",
  "px": 0.74373,
  "py": -1.65055,
  "hipH": 0.8,
  "yaw": -98.16209,
  "lean": 33.34744,
  "sideLean": 10,
  "twist": -30,
  "headFlex": 41.48789,
  "headLat": 5.18049,
  "fhX": -0.06572,
  "fhY": 0.42772,
  "fhZ": -0.24232,
  "freeSwivel": 89.6429,
  "racketAz": -44.66995,
  "racketEl": 22.39332,
  "racketRoll": 21.60326,
  "racketSwivel": 104.36768,
  "relFwd": 0.34064,
  "relLat": 0.2275,
  "relZ": 0.93442,
  "backToss": 0.10119,
  "tossAz": 3.62798,
  "apex": 0.3,
  "contactZ": 1.03994
 }
}
```

### Case D (racketArm) — zone miss 0.000

```json
{
 "preset": "backhand:search-racketArm",
 "serverPosition": [
  -0.1587,
  -1.9987,
  0.92
 ],
 "ball": [
  -0.6451,
  -1.8405,
  1.0226
 ],
 "releasePoint": [
  -0.7218,
  -1.7089,
  1.1195
 ],
 "freeHand": [
  -0.3977,
  -2.5477,
  1.2316
 ],
 "freeElbow": [
  -0.495,
  -2.2172,
  1.1569
 ],
 "freeShoulder": [
  -0.4894,
  -1.9743,
  1.3494
 ],
 "head": [
  -0.6727,
  -1.8173,
  1.3429
 ],
 "torsoYaw": 60,
 "torsoLean": 45,
 "headLean": 39.79,
 "headLateral": -19.97,
 "backwardToss": 0.1524,
 "tossLaunchAngleDeg": 6.74,
 "leftEyeVisibility": "BLOCKED BY racket upper arm",
 "rightEyeVisibility": "BLOCKED BY racket upper arm",
 "hiddenBy": [
  "racketArm"
 ],
 "freeArmLegal": true,
 "freeArmMinClearance_m": 0.1603,
 "deltaBallMinusFreeHand_m": -0.6278,
 "settings": {
  "recvX": 0,
  "recvDist": 0.55,
  "eyeH": 1.45,
  "ipd": 0.063,
  "criterion": "both",
  "wholeBall": false,
  "halfSpan": 0.9149999999999999,
  "floor": "hull",
  "margin": 0.02
 },
 "params": {
  "preset": "backhand:search-racketArm",
  "px": -0.15872,
  "py": -1.99871,
  "hipH": 0.92,
  "yaw": 60,
  "lean": 45,
  "sideLean": 1.79218,
  "twist": 30,
  "headFlex": 39.79358,
  "headLat": -19.97451,
  "fhX": -0.38549,
  "fhY": 0.08933,
  "fhZ": -0.32172,
  "freeSwivel": 17.59476,
  "racketAz": 52.26801,
  "racketEl": 35.62564,
  "racketRoll": 180,
  "racketSwivel": 94.36964,
  "relFwd": 0.63261,
  "relLat": -0.03055,
  "relZ": 1.11953,
  "backToss": 0.15238,
  "tossAz": -29.74174,
  "apex": 0.3,
  "contactZ": 1.02261
 }
}
```


## 9. Supplementary — stricter stance limits (no turning past side-on: yaw ≥ −90°; optionally ball inside the sidelines)

| envelope | torso (yaw ≥ −90°) | torso (yaw ≥ −90°, ball inside the sidelines) | head (yaw ≥ −90°) | shoulder (yaw ≥ −90°) |
|---|---|---|---|---|
| typical | **FOUND** +10.6 | **FOUND** +9.7 | **FOUND** +5.5 | **FOUND** +2.4 |
| common | **FOUND** +9.8 | **FOUND** +8.6 | none (-8.0) | none (-3.6) |

## 10. Supplementary — traditional pendulum serve struck close to the body

Side-on stance (pelvis yaw −95…−65°) with the **shoulder line also side-on** (yaw + twist within −100…−60°), trunk lean 15–40°, racket behind the ball swinging right→left, contact 0.15–0.30 m in front of the hips, toss chord ≤ 30°, free arm outside the 2.6.5 volume from 8 % of the toss on, server watches the ball. Target: any body part except the free arm. Three seeds × 30 000-candidate budget each.

| variant | result: min(obstruction, whole-toss free-arm clearance) cm | closest occluder (obstruction depth cm) |
|---|---|---|
| standard pendulum racket path | none (-2.0) | torso -2.0, racket -6.9 |
| wider racket path (blade more from the side/behind) | **FOUND** +3.7 | racketArm +3.7, racket +0.9 |
| for contrast: shoulder line free to turn away (twist ±30° on top of the stance) | none (-2.0) | torso -2.0, racket -6.9 |

_Total runtime 3988 s._
