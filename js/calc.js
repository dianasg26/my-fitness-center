import { state } from "./store.js";
import { todayISO, addDays } from "./util.js";

export function calcAge(birthISO) {
  const b = new Date(birthISO + "T00:00:00"), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}
export const bmi = (kg, cm) => kg / ((cm / 100) ** 2);
export const bmiCategory = (v) => (v < 18.5 ? "bajo peso" : v < 25 ? "saludable" : v < 30 ? "sobrepeso" : "fuera de rango típico");
export const healthyRange = (cm) => [18.5 * (cm / 100) ** 2, 24.9 * (cm / 100) ** 2];

const ACT = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9 };
export function calcBMR(p) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * calcAge(p.birthDate);
  return p.sex === "m" ? base + 5 : p.sex === "f" ? base - 161 : base - 78;
}
export const calcTDEE = (p) => calcBMR(p) * (ACT[p.activity] || 1.375);
export function calorieTarget(p) {
  const t = calcTDEE(p);
  return Math.round(p.goalType === "bajar" ? t - 450 : p.goalType === "subir" ? t + 300 : p.goalType === "tonificar" ? t - 150 : t);
}
export const waterGoal = (p) => Math.round(p.weightKg * 35);
export const kcalIn = (day) => (day?.foods || []).reduce((s, f) => s + (+f.kcal || 0), 0);

export function cyclePhaseInfo(p, iso) {
  const len = p.cycleLength || 28, per = p.periodLength || 5;
  const diff = Math.floor((new Date(iso + "T00:00:00") - new Date(p.lastPeriodStart + "T00:00:00")) / 86400000);
  const d = ((diff % len) + len) % len;
  const ovS = Math.max(per, Math.floor(len / 2) - 2), ovE = Math.min(len - 1, Math.floor(len / 2) + 1);
  if (d < per) return { d, len, phase: "menstrual", label: "fase menstrual", tone: "var(--red)", tip: "Energía más baja es normal. Prioriza movimiento suave, hidratación y dormir bien." };
  if (d < ovS) return { d, len, phase: "folicular", label: "fase folicular", tone: "var(--violet)", tip: "Tu energía va subiendo. Buen momento para meterle intensidad nueva al entreno." };
  if (d <= ovE) return { d, len, phase: "ovulatoria", label: "fase ovulatoria", tone: "var(--pink)", tip: "Pico de fuerza y energía. Aprovecha para tus mejores marcas." };
  return { d, len, phase: "lutea", label: "fase lútea", tone: "var(--text)", tip: "Puede bajar un poco la energía antes del periodo. Mantén el hábito aunque sea con menos intensidad." };
}

/* activity score per day (0-4) used by the heatmap and the streak */
export function dayScore(iso, ctx) {
  const p = state.profile, d = state.days[iso];
  let s = 0;
  if (ctx.gymDates.has(iso)) s += 2;
  if (d) {
    if (d.foods?.length) s += 1;
    if ((d.steps || 0) >= (p?.stepsGoal || 8000) * 0.8) s += 1;
    if (p && (d.waterMl || 0) >= waterGoal(p) * 0.8) s += 1;
  }
  if (ctx.weightDates.has(iso)) s += 1;
  return Math.min(4, s);
}
export const activityCtx = () => ({ gymDates: new Set(state.gym.map((g) => g.date)), weightDates: new Set(state.weightLogs.map((w) => w.date)) });

export function streak() {
  const ctx = activityCtx();
  let iso = todayISO(), n = 0;
  if (dayScore(iso, ctx) === 0) iso = addDays(iso, -1); // today still open
  while (n < 400 && dayScore(iso, ctx) > 0) { n++; iso = addDays(iso, -1); }
  return n;
}
