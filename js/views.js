import { state, meta, getDay, touchDay, addWeight, addCycle, touchProfile } from "./store.js";
import { $, esc, uid, todayISO, addDays, fmtDate, fmtNum, fmtDur, norm, weekdayName, actions, inputs, toast, confetti, haptic } from "./util.js";
import { PHRASES, pickPhrase, FOOD_DB } from "./data.js";
import { calcBMR, calorieTarget, waterGoal, kcalIn, cyclePhaseInfo, dayScore, activityCtx, streak } from "./calc.js";
import { simCard, simUpdate, muscleFigure } from "./figures.js";
import { sessionProgress, todayRoutine, routineMuscles, resumeSession } from "./gym.js";

const vw = (n) => $(`[data-view="${n}"]`);
const again = () => window.dispatchEvent(new Event("mfc:render"));
const goto = (v) => window.dispatchEvent(new CustomEvent("mfc:goto", { detail: v }));

const cells = (pct, color, n = 24) => {
  const on = Math.round(Math.max(0, Math.min(1, pct)) * n);
  return `<div class="cells" style="--c:${color}">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</div>`;
};
const metric = (label, val, pct, color) => `<div class="metric"><div class="top"><span>${label}</span><b style="color:${pct >= 1 ? color : "var(--text)"}">${val}</b></div>${cells(pct, color)}</div>`;

function celebrate(day, key, oldV, newV, goal) {
  if (goal > 0 && oldV < goal && newV >= goal) {
    day._cel = day._cel || {};
    if (!day._cel[key]) { day._cel[key] = true; confetti(); toast("Meta del día cumplida ★"); haptic([20, 40, 20]); }
  }
}

/* ============================ HOY ============================ */
export function renderHoy() {
  const p = state.profile, iso = todayISO(), day = state.days[iso] || { foods: [], steps: 0, waterMl: 0 };
  const sess = sessionProgress(), tr = todayRoutine();
  const target = calorieTarget(p), kin = kcalIn(day), sg = p.stepsGoal || 8000, wg = waterGoal(p);
  const total = Math.abs(p.startWeightKg - p.goalWeightKg) || 1;
  const done = Math.max(0, Math.min(1, Math.abs(p.startWeightKg - p.weightKg) / total));

  let hero;
  if (sess) {
    hero = `<div class="panel hero"><div class="ph"><b>sesión en curso</b><span class="mono pink">● live</span></div>
      <h2>${esc(state.session.name)}</h2><div class="exlist"><span>${fmtDur(sess.elapsed)}</span> · ${sess.done}/${sess.total} ejercicios</div>
      <button class="btn primary block go" data-act="s-resume">&gt; continuar sesión</button></div>`;
  } else if (tr) {
    hero = `<div class="panel hero"><div class="ph"><b>toca hoy · ${weekdayName()}</b></div>
      <div class="row" style="align-items:flex-start;gap:14px">${muscleFigure(routineMuscles(tr), 84)}<div class="grow"><h2>${esc(tr.name)}</h2>
      <div class="exlist">${tr.exercises.map((e) => `${esc(e.name)} <span>${e.sets}×${esc(e.reps)}</span>`).join("<br>")}</div></div></div>
      <button class="btn primary block go" data-act="r-start" data-id="${tr.id}">&gt; empezar rutina</button></div>`;
  } else if (state.routines.length) {
    hero = `<div class="panel hero"><div class="ph"><b>${weekdayName()} · sin rutina asignada</b></div><div class="scroll-x">${state.routines.map((r) => `<button class="chip" data-act="r-start" data-id="${r.id}">&gt; ${esc(r.name)}</button>`).join("")}</div></div>`;
  } else {
    hero = `<div class="panel hero"><div class="ph"><b>gym</b></div><p class="dim" style="margin:0 0 12px">Crea tus rutinas por carpeta (por día o por grupo muscular) para empezarlas con un toque.</p><button class="btn primary block" data-act="goto" data-to="gym">+ crear mi primera rutina</button></div>`;
  }

  let tag = "frase del día", phrase;
  if (p.cycleEnabled && p.lastPeriodStart) { const c = cyclePhaseInfo(p, iso); tag = c.label; phrase = pickPhrase(PHRASES[c.phase], iso + c.phase); }
  else phrase = pickPhrase(PHRASES.general, iso);

  const ctx = activityCtx(), weeks = 15, start = new Date(); start.setDate(start.getDate() - (weeks * 7 - 1) - start.getDay());
  const heat = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = todayISO(d);
    heat.push(k > iso ? `<i style="visibility:hidden"></i>` : `<i class="${dayScore(k, ctx) ? "l" + dayScore(k, ctx) : ""} ${k === iso ? "today" : ""}" title="${k}"></i>`);
  }

  vw("hoy").innerHTML = `
    <div><p class="title">~/hoy <b>--${fmtDate(iso, { day: "numeric", month: "short" }).replace(" ", "-")}</b></p><h1>Hola, ${esc(p.name)}</h1></div>
    ${hero}
    <div class="panel"><div class="ph"><b>progreso de hoy</b><span class="mono">streak ${streak()}d</span></div><div class="metrics">
      ${metric("kcal", `${fmtNum(kin)} / ${fmtNum(target)}`, kin / target, "var(--pink)")}
      ${metric("pasos", `${fmtNum(day.steps || 0)} / ${fmtNum(sg)}`, (day.steps || 0) / sg, "var(--violet)")}
      ${metric("agua", `${fmtNum(day.waterMl || 0)} / ${fmtNum(wg)} ml`, (day.waterMl || 0) / wg, "var(--red)")}
      ${metric("peso→meta", `${p.weightKg.toFixed(1)} → ${p.goalWeightKg.toFixed(1)} kg`, done, "var(--pink)")}
    </div></div>
    <div class="g2"><button class="btn" data-act="q-water" data-ml="250">+ vaso 250ml</button><button class="btn" data-act="q-steps" data-n="1000">+ 1,000 pasos</button>
      <button class="btn" data-act="q-food">+ comida</button><button class="btn" data-act="q-weight">+ peso</button></div>
    <div class="panel"><div class="quote"><em>// ${esc(tag)}</em>“${esc(phrase)}”</div></div>
    <div class="panel"><div class="ph"><b>contribuciones</b><span>últimas ${weeks} semanas</span></div><div class="heat" style="grid-template-columns:repeat(${weeks},1fr)">${heat.join("")}</div></div>
    <div class="panel"><div class="ph"><b>referencia corporal</b></div><div id="simBox">${simCard(p, 100)}</div></div>`;
}
Object.assign(actions, {
  "s-resume": () => resumeSession(),
  "q-water": (el) => { const d = getDay(todayISO()), o = d.waterMl || 0; d.waterMl = o + +el.dataset.ml; celebrate(d, "agua", o, d.waterMl, waterGoal(state.profile)); touchDay(todayISO()); haptic(10); again(); toast(`+${el.dataset.ml} ml`); },
  "q-steps": (el) => { const d = getDay(todayISO()), o = d.steps || 0; d.steps = o + +el.dataset.n; celebrate(d, "pasos", o, d.steps, state.profile.stepsGoal || 8000); touchDay(todayISO()); haptic(10); again(); toast(`+${fmtNum(+el.dataset.n)} pasos`); },
  "q-food": () => { meta.currentDay = todayISO(); goto("log"); setTimeout(() => $("#fq")?.focus(), 80); },
  "q-weight": () => { meta.currentDay = todayISO(); goto("log"); setTimeout(() => $("#wIn")?.focus(), 80); },
});
inputs["sim"] = (el) => {
  const u = simUpdate(state.profile, +el.value);
  $("#simGoalFig").innerHTML = u.svg; $("#simGoalTxt").innerHTML = u.txt;
};

/* ============================ LOG ============================ */
let foodQ = "", foodQty = 1;
const recentFoods = () => {
  const seen = new Set(), out = [];
  for (const d of Object.keys(state.days).sort().reverse()) {
    (state.days[d].foods || []).slice().reverse().forEach((f) => {
      if (!seen.has(f.name) && out.length < 8) { seen.add(f.name); out.push(f); }
    });
  }
  return out;
};
function foodResults() {
  const q = norm(foodQ.trim());
  if (!q) {
    const r = recentFoods();
    return r.length ? `<div class="small dim mono">recientes</div><div class="fs-vars">${r.map((f, i) => `<button class="chip" data-act="food-again" data-i="${i}">${esc(f.name)} <b>${f.kcal}</b></button>`).join("")}</div>`
      : `<div class="empty">busca un alimento para ver sus variantes y calorías</div>`;
  }
  const hits = FOOD_DB.map((f, i) => ({ f, i })).filter(({ f }) => norm(f.name).includes(q) || f.variants.some((v) => norm(v.label).includes(q))).slice(0, 8);
  if (!hits.length) return `<div class="empty">sin resultados · agrégalo manual abajo</div>`;
  return hits.map(({ f, i }) => `<div class="fs-item"><div class="row between"><span class="n">${esc(f.name)}</span><span class="u">${esc(f.unit)}</span></div>
    <div class="fs-vars">${f.variants.map((v, vi) => `<button class="chip" data-act="food-add" data-i="${i}" data-v="${vi}">${esc(v.label)} <b>${Math.round(v.kcal * foodQty)}</b></button>`).join("")}</div>
    <div class="macro" style="margin-top:7px">por porción · P ${Math.round(f.variants[0].p * foodQty)}g · C ${Math.round(f.variants[0].c * foodQty)}g · G ${Math.round(f.variants[0].f * foodQty)}g (${esc(f.variants[0].label.toLowerCase())})</div></div>`).join("");
}

function sparkline() {
  const logs = [...state.weightLogs].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30);
  if (logs.length < 2) return `<div class="empty">registra tu peso unos días para ver la tendencia</div>`;
  const W = 300, H = 84, pad = 8, vals = logs.map((l) => l.kg), mn = Math.min(...vals) - 0.4, mx = Math.max(...vals) + 0.4;
  const pts = logs.map((l, i) => [pad + (W - 2 * pad) * (i / (logs.length - 1)), pad + (H - 2 * pad) * (1 - (l.kg - mn) / (mx - mn))]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
  const last = pts.at(-1);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Tendencia de peso">
    <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF4FA3" stop-opacity=".35"/><stop offset="1" stop-color="#FF4FA3" stop-opacity="0"/></linearGradient></defs>
    <path d="${line}L${W - pad} ${H}L${pad} ${H}Z" fill="url(#spk)"/><path d="${line}" fill="none" stroke="#FF4FA3" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="#FF4FA3"/><circle cx="${last[0]}" cy="${last[1]}" r="9" fill="#FF4FA3" opacity=".25"/>
    <text x="${pad}" y="${H - 1}" font-family="monospace" font-size="9" fill="#9A89AD">${Math.min(...vals).toFixed(1)}</text><text x="${W - pad}" y="9" text-anchor="end" font-family="monospace" font-size="9" fill="#9A89AD">${Math.max(...vals).toFixed(1)} kg</text></svg>`;
}

export function renderLog() {
  const p = state.profile, iso = meta.currentDay, day = getDay(iso);
  const kin = kcalIn(day), kout = Math.round(calcBMR(p)) + (+day.exerciseKcal || 0), sg = p.stepsGoal || 8000, wg = waterGoal(p);
  const w = [...state.weightLogs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  vw("log").innerHTML = `
    <div class="row between"><button class="iconbtn" data-act="day-prev" aria-label="Día anterior"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div style="text-align:center"><p class="title">~/log <b>--${iso}</b></p><h2>${iso === todayISO() ? "Hoy" : fmtDate(iso)}</h2></div>
      <button class="iconbtn" data-act="day-next" aria-label="Día siguiente"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button></div>

    <div class="panel"><div class="ph"><b>comida</b><span class="mono"><span class="pink">${fmtNum(kin)}</span> kcal</span></div>
      <input type="text" id="fq" data-live="food-q" placeholder="buscar: huevo, pollo, arroz…" autocomplete="off" value="${esc(foodQ)}">
      <div class="fs-qty">porción <span class="faint">→</span>${[0.5, 1, 1.5, 2].map((q) => `<button class="chip ${foodQty === q ? "on" : ""}" data-act="food-qty" data-q="${q}">×${q}</button>`).join("")}</div>
      <div class="fs-res" id="fsRes">${foodResults()}</div>
      <div class="ph" style="margin:16px 0 8px"><b>manual</b></div>
      <div class="row"><input type="text" id="mName" placeholder="Ej. Ensalada con pollo"><input type="number" id="mKcal" placeholder="kcal" inputmode="numeric" style="width:84px"><button class="iconbtn" data-act="food-manual" aria-label="Agregar"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div>
      <div style="margin-top:14px">${(day.foods || []).length ? day.foods.map((f, i) => `<div class="li"><div><div class="t">${esc(f.name)}</div>${f.p != null ? `<div class="d">P ${f.p}g · C ${f.c}g · G ${f.fat}g</div>` : ""}</div>
        <div class="row" style="gap:8px"><span class="v">${f.kcal}</span><button class="iconbtn" style="width:32px;height:32px" data-act="food-del" data-i="${i}" aria-label="Quitar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>`).join("") : '<div class="empty">sin comidas registradas</div>'}</div>
    </div>

    <div class="panel"><div class="ph"><b>balance</b><span class="mono">meta ${fmtNum(calorieTarget(p))} kcal</span></div>
      <div class="g2"><div><div class="small dim mono">consumidas</div><div class="mono" style="font-size:22px;font-weight:600">${fmtNum(kin)}</div></div>
      <div><div class="small dim mono">quemadas</div><div class="mono" style="font-size:22px;font-weight:600">${fmtNum(kout)}</div></div></div>
      <div class="mono small ${kin - kout > 0 ? "red" : "violet"}" style="margin-top:8px">neto ${kin - kout > 0 ? "+" : ""}${fmtNum(kin - kout)} kcal</div>
      <div class="row" style="margin-top:12px"><input type="number" id="exK" inputmode="numeric" placeholder="kcal extra por ejercicio" value="${day.exerciseKcal || ""}"><button class="btn sm" data-act="ex-save">guardar</button></div>
      <div class="small dim" style="margin-top:6px">Incluye tu metabolismo basal estimado; suma solo lo que quemaste entrenando.</div></div>

    <div class="panel"><div class="ph"><b>pasos</b><span class="mono">${fmtNum(day.steps || 0)} / ${fmtNum(sg)}</span></div>${cells((day.steps || 0) / sg, "var(--violet)")}
      <div class="row wrap" style="margin-top:12px;gap:8px"><button class="chip v" data-act="steps-add" data-n="1000">+1,000</button><button class="chip v" data-act="steps-add" data-n="2000">+2,000</button><button class="chip v" data-act="steps-add" data-n="5000">+5,000</button>
        <input type="number" id="stN" inputmode="numeric" placeholder="otro" style="width:90px;min-height:36px;padding:6px 10px"><button class="chip" data-act="steps-custom">+</button><button class="chip" data-act="steps-reset">reset</button></div></div>

    <div class="panel"><div class="ph"><b>agua</b><span class="mono">${fmtNum(day.waterMl || 0)} / ${fmtNum(wg)} ml</span></div>${cells((day.waterMl || 0) / wg, "var(--red)")}
      <div class="row wrap" style="margin-top:12px;gap:8px"><button class="chip" data-act="water-add" data-ml="250">+250</button><button class="chip" data-act="water-add" data-ml="500">+500</button><button class="chip" data-act="water-add" data-ml="750">+750</button><button class="chip" data-act="water-add" data-ml="-250">−250</button></div></div>

    <div class="panel"><div class="ph"><b>peso</b><span class="mono pink">${(w ? w.kg : p.weightKg).toFixed(1)} kg</span></div>${sparkline()}
      <div class="row" style="margin-top:12px"><input type="number" id="wIn" inputmode="decimal" step="0.1" placeholder="peso de ${iso === todayISO() ? "hoy" : iso} (kg)"><button class="btn primary sm" data-act="w-save">guardar</button></div></div>`;
}

Object.assign(actions, {
  "day-prev": () => { meta.currentDay = addDays(meta.currentDay, -1); renderLog(); },
  "day-next": () => { if (meta.currentDay < todayISO()) { meta.currentDay = addDays(meta.currentDay, 1); renderLog(); } },
  "food-qty": (el) => { foodQty = +el.dataset.q; renderLog(); },
  "food-add": (el) => {
    const f = FOOD_DB[+el.dataset.i], v = f.variants[+el.dataset.v], q = foodQty;
    const kin0 = kcalIn(getDay(meta.currentDay)), d = getDay(meta.currentDay);
    d.foods.push({ name: `${f.name} (${v.label})${q !== 1 ? " ×" + q : ""}`, kcal: Math.round(v.kcal * q), p: Math.round(v.p * q), c: Math.round(v.c * q), fat: Math.round(v.f * q), time: new Date().toISOString() });
    celebrate(d, "kcal", kin0, kcalIn(d), calorieTarget(state.profile));
    touchDay(meta.currentDay); haptic(10); toast(`+ ${f.name} (${v.label})`); renderLog();
  },
  "food-again": (el) => {
    const f = recentFoods()[+el.dataset.i]; if (!f) return;
    getDay(meta.currentDay).foods.push({ ...f, time: new Date().toISOString() });
    touchDay(meta.currentDay); haptic(10); toast(`+ ${f.name}`); renderLog();
  },
  "food-manual": () => {
    const n = $("#mName").value.trim(), k = +$("#mKcal").value; if (!n || !k) return toast("Nombre y kcal", "err");
    getDay(meta.currentDay).foods.push({ name: n, kcal: k, time: new Date().toISOString() }); touchDay(meta.currentDay); renderLog();
  },
  "food-del": (el) => { getDay(meta.currentDay).foods.splice(+el.dataset.i, 1); touchDay(meta.currentDay); renderLog(); },
  "ex-save": () => { getDay(meta.currentDay).exerciseKcal = +$("#exK").value || 0; touchDay(meta.currentDay); toast("Guardado"); renderLog(); },
  "steps-add": (el) => { const d = getDay(meta.currentDay), o = d.steps || 0; d.steps = o + +el.dataset.n; celebrate(d, "pasos", o, d.steps, state.profile.stepsGoal || 8000); touchDay(meta.currentDay); renderLog(); },
  "steps-custom": () => { const n = +$("#stN").value; if (!n) return; const d = getDay(meta.currentDay), o = d.steps || 0; d.steps = o + n; celebrate(d, "pasos", o, d.steps, state.profile.stepsGoal || 8000); touchDay(meta.currentDay); renderLog(); },
  "steps-reset": () => { getDay(meta.currentDay).steps = 0; touchDay(meta.currentDay); renderLog(); },
  "water-add": (el) => { const d = getDay(meta.currentDay), o = d.waterMl || 0; d.waterMl = Math.max(0, o + +el.dataset.ml); celebrate(d, "agua", o, d.waterMl, waterGoal(state.profile)); touchDay(meta.currentDay); renderLog(); },
  "w-save": () => { const v = parseFloat($("#wIn").value); if (!v) return; addWeight(meta.currentDay, v); toast("Peso guardado"); renderLog(); },
});
inputs["food-q"] = (el) => { foodQ = el.value; $("#fsRes").innerHTML = foodResults(); };
export const focusFood = (name) => { foodQ = name; };

/* ============================ CICLO ============================ */
export function renderCiclo() {
  const p = state.profile, el = vw("ciclo");
  if (!p.cycleEnabled) {
    el.innerHTML = `<div><p class="title">~/ciclo <b>--off</b></p><h1>Ciclo</h1></div>
      <div class="panel"><p class="dim" style="margin:0 0 12px">Activa el seguimiento para recibir frases y tips distintos según tu fase.</p><button class="btn primary block" data-act="cy-enable">activar seguimiento</button></div>`;
    return;
  }
  const c = cyclePhaseInfo(p, todayISO());
  const hist = [...state.cycles].sort((a, b) => (a.start < b.start ? 1 : -1));
  const bar = Array.from({ length: c.len }, (_, i) => `<i class="${i <= c.d ? "on" : ""}"></i>`).join("");
  el.innerHTML = `<div><p class="title">~/ciclo <b>--día-${c.d + 1}</b></p><h1>Ciclo</h1></div>
    <div class="panel hero"><div class="ph"><b>día ${c.d + 1} de ${c.len}</b></div><h2 style="color:${c.tone}">${c.label}</h2><p class="dim" style="margin:8px 0 14px">${c.tip}</p>
      <div class="cells" style="--c:${c.tone};grid-template-columns:repeat(${Math.min(c.len, 40)},1fr)">${bar}</div></div>
    <div class="panel"><div class="ph"><b>configuración</b></div>
      <div class="g2"><div class="field"><label class="l">último inicio</label><input type="date" id="cyLast" value="${p.lastPeriodStart}"></div>
      <div class="field"><label class="l">duración ciclo</label><input type="number" id="cyLen" value="${p.cycleLength}"></div></div>
      <div class="row" style="margin-top:12px"><button class="btn grow" data-act="cy-save">actualizar</button><button class="btn primary grow" data-act="cy-today">hoy inició</button></div></div>
    <div class="panel"><div class="ph"><b>historial</b></div>${hist.length ? hist.map((x) => `<div class="li"><div class="t">${fmtDate(x.start)}</div></div>`).join("") : '<div class="empty">sin ciclos anteriores</div>'}</div>`;
}
Object.assign(actions, {
  "cy-enable": () => { const p = state.profile; p.cycleEnabled = true; p.lastPeriodStart ||= todayISO(); p.cycleLength ||= 28; p.periodLength ||= 5; touchProfile(); renderCiclo(); },
  "cy-save": () => { const p = state.profile; p.lastPeriodStart = $("#cyLast").value || p.lastPeriodStart; p.cycleLength = +$("#cyLen").value || 28; touchProfile(); toast("Ciclo actualizado"); renderCiclo(); },
  "cy-today": () => { const p = state.profile; if (p.lastPeriodStart) addCycle({ id: uid(), start: p.lastPeriodStart }); p.lastPeriodStart = todayISO(); touchProfile(); toast("Ciclo reiniciado"); renderCiclo(); },
});

