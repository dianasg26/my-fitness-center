import { clamp } from "./util.js";
import { MUSCLE_LABEL } from "./data.js";

/* ============================================================
   Muscle reference diagram: front + back mannequin, target zones lit.
   Zones are drawn for the left half (x < 50) and mirrored.
   ============================================================ */
const FRONT = {
  shoulders: "M31 36C24 36 20 42 21 50C26 52 31 50 34 44Z",
  chest: "M49 38C42 36 35 39 33 46C33 54 39 58 49 57Z",
  biceps: "M21 53C18 60 18 68 20 74L27 74C29 68 29 60 28 53Z",
  forearms: "M19 77C17 86 17 94 18 101L25 101C26 94 26 86 26 77Z",
  core: "M49 60L49 93C44 93 39 90 37 84C36 74 37 66 40 61Z",
  quads: "M48 97C42 97 36 100 35 109C34 123 37 137 40 149L48 149C49 131 49 113 48 97Z",
  calves: "M40 153C38 169 39 189 41 207L47 207C48 189 48 169 48 153Z",
};
const BACK = {
  traps: "M49 27C44 30 40 34 34 38C38 44 44 50 49 54Z",
  shoulders: "M31 36C24 36 20 42 21 50C26 52 31 50 34 44Z",
  back: "M49 57C42 53 36 51 34 55C33 67 38 80 49 86Z",
  lowback: "M49 87C44 86 41 84 38 82C38 90 41 95 49 97Z",
  triceps: "M21 53C18 60 18 68 20 74L27 74C29 68 29 60 28 53Z",
  forearms: "M19 77C17 86 17 94 18 101L25 101C26 94 26 86 26 77Z",
  glutes: "M49 99C42 97 36 100 35 109C36 117 42 119 49 117Z",
  hamstrings: "M48 121C42 121 36 123 36 131C36 139 38 145 40 151L48 151C49 141 49 129 48 121Z",
  calves: "M40 154C37 167 38 185 41 205L47 205C49 185 49 167 48 154Z",
};

function figure(zones, x, label, prim, sec) {
  const mk = (id, d) => {
    const cls = "mz" + (prim.includes(id) ? " p" : sec.includes(id) ? " s" : "");
    return `<path class="${cls}" d="${d}"/><path class="${cls}" d="${d}" transform="translate(100 0) scale(-1 1)"/>`;
  };
  return `<g transform="translate(${x} 4)">
    <circle class="mz base" cx="50" cy="15" r="10"/><rect class="mz base" x="45" y="25" width="10" height="6" rx="2"/>
    <ellipse class="mz base" cx="21" cy="105" rx="4.5" ry="5"/><ellipse class="mz base" cx="79" cy="105" rx="4.5" ry="5"/>
    <ellipse class="mz base" cx="43" cy="212" rx="6" ry="3.5"/><ellipse class="mz base" cx="57" cy="212" rx="6" ry="3.5"/>
    ${Object.entries(zones).map(([id, d]) => mk(id, d)).join("")}
    <text class="fig-lbl" x="50" y="228" text-anchor="middle">${label}</text></g>`;
}

export function muscleFigure(m, size = 92) {
  const prim = m?.p || [], sec = m?.s || [];
  if (prim.includes("cardio")) {
    return `<svg class="musclefig" viewBox="0 0 100 100" style="width:${size * 0.55}px;height:${size * 0.55}px" aria-label="cardio">
      <path class="mz p" d="M50 82C20 62 12 44 24 30C34 20 46 26 50 36C54 26 66 20 76 30C88 44 80 62 50 82Z"/>
      <path d="M20 52H38L44 40L54 64L60 52H80" fill="none" stroke="var(--bg)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const label = [...prim, ...sec].length ? "" : "";
  return `<svg class="musclefig" viewBox="0 0 210 236" style="width:${size}px;height:${size * 1.124}px" aria-label="músculos: ${prim.map((x) => MUSCLE_LABEL[x]).join(", ")}">
    ${figure(FRONT, 0, "FRENTE", prim, sec)}${figure(BACK, 110, "ESPALDA", prim, sec)}${label}</svg>`;
}

export const muscleText = (m) => {
  const p = (m?.p || []).map((x) => MUSCLE_LABEL[x]), s = (m?.s || []).map((x) => MUSCLE_LABEL[x]);
  return { p: p.join(" · "), s: s.join(" · ") };
};

/* ============================================================
   Body blueprint: parametric front silhouette driven by BMI.
   ============================================================ */
function smooth(pts, close = false) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const a = close || i > 0 ? p0 : p1, b = close || i < n - 2 ? p3 : p2;
    const c1 = [p1[0] + (p2[0] - a[0]) / 6, p1[1] + (p2[1] - a[1]) / 6];
    const c2 = [p2[0] - (b[0] - p1[0]) / 6, p2[1] - (b[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + (close ? "Z" : "");
}
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

export const bmiFactor = (bmi) => clamp((bmi - 17) / (36 - 17), 0, 1);

function bodyPaths(f) {
  const torsoR = [[7, 44], [20, 50], [34 + f * 5, 58], [31 + f * 8, 86], [21 + f * 19, 128], [33 + f * 16, 162], [30 + f * 15, 176]];
  const torso = smooth([...torsoR, [0, 182], ...mirror(torsoR).reverse()], true);
  const legR = [[31 + f * 15, 168], [28 + f * 11, 214], [18 + f * 5, 260], [19 + f * 6, 292], [11 + f * 2, 338], [14 + f * 2, 350], [2, 350], [3, 338], [5 + f * 2, 292], [5 + f * 2, 262], [4 + f * 3, 214], [2, 180]];
  const leg = smooth(legR, true);
  const armR = [[34 + f * 5, 60], [48 + f * 4, 100], [50 + f * 4, 126], [47 + f * 3, 176], [46 + f * 2, 192], [39 + f * 2, 192], [38 + f * 3, 176], [41 + f * 3, 128], [39 + f * 4, 100], [31 + f * 7, 90]];
  const arm = smooth(armR, true);
  return { torso, leg, arm, waist: 21 + f * 19, hip: 33 + f * 16, shoulder: 34 + f * 5 };
}

export function bodySVG(bmi, kind = "now") {
  const f = bmiFactor(bmi), P = bodyPaths(f);
  const fill = kind === "goal" ? "url(#gGoal)" : "url(#gNow)";
  const guide = (y, x, lbl) => `<line class="bp-guide" x1="${-x - 12}" x2="${x + 12}" y1="${y}" y2="${y}"/><text class="bp-lbl" x="${x + 15}" y="${y + 3}">${lbl}</text>`;
  return `<svg class="bodybp" viewBox="-86 0 172 372" aria-hidden="true">
    <g class="bp-fig" fill="${fill}">
      <circle cx="0" cy="24" r="15"/><rect x="-6" y="36" width="12" height="14" rx="4"/>
      <path d="${P.arm}"/><path d="${P.arm}" transform="scale(-1 1)"/>
      <path d="${P.leg}"/><path d="${P.leg}" transform="scale(-1 1)"/>
      <path d="${P.torso}"/>
    </g>
    <path class="bp-line" d="M0 52V182" /><ellipse class="bp-line" cx="0" cy="130" rx="3" ry="1.5"/>
    ${guide(58, P.shoulder, "H")}${guide(128, P.waist, "C")}${guide(164, P.hip, "CD")}
    <path class="bp-corner" d="M-82 10V2H-74M82 10V2H74M-82 362V370H-74M82 362V370H74"/>
  </svg>`;
}

export function simCard(p, prog = 100) {
  const bmiNow = p.weightKg / ((p.heightCm / 100) ** 2);
  const bmiGoal = p.goalWeightKg / ((p.heightCm / 100) ** 2);
  const k = prog / 100;
  const w = p.weightKg + (p.goalWeightKg - p.weightKg) * k;
  const b = bmiNow + (bmiGoal - bmiNow) * k;
  return `<div class="sim">
    <div class="sim-grid">
      <figure><figcaption>ahora</figcaption>${bodySVG(bmiNow, "now")}<div class="sim-n mono">${p.weightKg.toFixed(1)} kg<br><span>IMC ${bmiNow.toFixed(1)}</span></div></figure>
      <div class="sim-arrow mono">&rarr;</div>
      <figure><figcaption>proyección</figcaption><div id="simGoalFig">${bodySVG(b, "goal")}</div><div class="sim-n mono" id="simGoalTxt">${w.toFixed(1)} kg<br><span>IMC ${b.toFixed(1)}</span></div></figure>
    </div>
    <label class="sim-range"><span class="mono">0%</span><input type="range" min="0" max="100" value="${prog}" data-live="sim"><span class="mono">meta</span></label>
    <div class="dim small">Ilustración orientativa de proporciones según IMC. No es una predicción médica.</div>
  </div>`;
}

export function simUpdate(p, prog) {
  const bmiNow = p.weightKg / ((p.heightCm / 100) ** 2);
  const bmiGoal = p.goalWeightKg / ((p.heightCm / 100) ** 2);
  const k = prog / 100;
  const w = p.weightKg + (p.goalWeightKg - p.weightKg) * k;
  const b = bmiNow + (bmiGoal - bmiNow) * k;
  return { svg: bodySVG(b, "goal"), txt: `${w.toFixed(1)} kg<br><span>IMC ${b.toFixed(1)}</span>` };
}
