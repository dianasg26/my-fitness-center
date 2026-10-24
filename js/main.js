import * as store from "./store.js";
import { state, meta, status } from "./store.js";
import { $, $$, esc, todayISO, norm, actions, inputs, bindDelegation, toast, confetti } from "./util.js";
import { FOOD_DB } from "./data.js";
import { bmi, bmiCategory, healthyRange } from "./calc.js";
import { simCard } from "./figures.js";
import { renderGym, startSession, setMinimized, hasSession, resumeSession } from "./gym.js";
import { renderHoy, renderLog, renderCiclo, focusFood } from "./views.js";

const VIEWS = ["hoy", "log", "gym", "ciclo", "yo"];
const RENDER = { hoy: renderHoy, log: renderLog, gym: renderGym, ciclo: renderCiclo, yo: renderYo };
let current = "hoy";
let appStarted = false;

/* ---------------- router ---------------- */
function goto(v) {
  if (!VIEWS.includes(v)) v = "hoy";
  if (hasSession()) setMinimized(v !== "gym");
  current = v;
  $$("section[data-view]").forEach((s) => s.classList.toggle("on", s.dataset.view === v));
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.to === v));
  $("#path").textContent = "~/" + v;
  if (location.hash.slice(1) !== v) history.replaceState(null, "", "#" + v);
  renderCurrent();
  window.scrollTo({ top: 0 });
}
const renderCurrent = () => { if (state.profile && appStarted) RENDER[current](); };
window.addEventListener("mfc:goto", (e) => goto(e.detail));
window.addEventListener("mfc:render", renderCurrent);
window.addEventListener("mfc:pulled", renderCurrent);
actions.goto = (el) => goto(el.dataset.to);

/* ---------------- sync indicator ---------------- */
const SYNC_TXT = { synced: "sync", syncing: "sync…", offline: "offline", "signed-out": "login", local: "local", init: "…" };
function updateSync() {
  const s = $("#sync"); if (!s) return;
  s.dataset.m = status.mode;
  $("#syncTxt").textContent = (SYNC_TXT[status.mode] || status.mode) + (status.pending && !["synced", "local"].includes(status.mode) ? ` ·${status.pending}` : "");
}

/* ---------------- gate: login + onboarding ---------------- */
const ov = () => $("#overlay");
const showGate = (html) => { ov().className = "on"; ov().innerHTML = `<div class="gate">${html}</div>`; };
const hideGate = () => { ov().className = ""; ov().innerHTML = ""; };
const ERR = { "Invalid login credentials": "Correo o contraseña incorrectos.", "User already registered": "Ese correo ya tiene cuenta: inicia sesión.", "Email not confirmed": "Confirma tu correo (revisa tu bandeja) y vuelve a entrar." };
const errMsg = (e) => ERR[e.message] || e.message || "Error de conexión";

function showLogin(note = "") {
  showGate(`<p class="title">~/auth</p><h1>My Fitness<br><span class="pink">Center</span></h1>
    <p class="dim" style="margin:0">Inicia sesión para guardar tus datos en la nube y usarlos en cualquier dispositivo.</p>
    <div class="field"><label class="l">email</label><input type="email" id="aEmail" autocomplete="username" inputmode="email" autocapitalize="none"></div>
    <div class="field"><label class="l">contraseña</label><input type="password" id="aPass" autocomplete="current-password"></div>
    <div class="err" id="aErr">${esc(note)}</div>
    <button class="btn primary block" data-act="a-in">iniciar sesión</button>
    <button class="btn block" data-act="a-up">crear cuenta</button>
    <button class="btn ghost block" data-act="a-local">usar solo en este dispositivo</button>
    <p class="small faint mono" style="margin-top:auto">// datos protegidos con RLS en Supabase · solo la cuenta dueña puede leer o escribir</p>`);
}
async function authFlow(kind, btn) {
  const email = $("#aEmail").value.trim(), pw = $("#aPass").value, err = $("#aErr");
  if (!email || pw.length < 6) { err.textContent = "Email y contraseña (mínimo 6 caracteres)."; return; }
  btn.disabled = true; err.textContent = "…";
  try {
    if (kind === "in") await store.signIn(email, pw);
    else {
      const r = await store.signUp(email, pw);
      if (r === "confirm") { err.style.color = "var(--violet)"; err.textContent = "Cuenta creada. Confirma el correo que te enviamos y luego inicia sesión."; btn.disabled = false; return; }
      if (r === "denied") { err.textContent = status.error; btn.disabled = false; return; }
    }
    if (!status.user) { err.textContent = status.error || "No se pudo iniciar sesión."; btn.disabled = false; return; }
    afterLogin();
  } catch (e) { err.textContent = errMsg(e); btn.disabled = false; }
}
actions["a-in"] = (el) => authFlow("in", el);
actions["a-up"] = (el) => authFlow("up", el);
actions["a-local"] = () => { store.useLocalOnly(); afterLogin(); };
function afterLogin() { state.profile ? startApp() : showOnboarding(); }

let ob = {}, obStep = 0;
const OB = 5;
function showOnboarding() {
  ob = { sex: "f", activity: "moderado", goalType: "tonificar", cycle: "no", cycleLen: 28, periodLen: 5, ...ob };
  renderOb();
}
const pick = (f, v, t) => `<div class="pick ${ob[f] === v ? "on" : ""}" data-act="ob-pick" data-f="${f}" data-v="${v}">${t}</div>`;
function renderOb() {
  const steps = `<div class="steps">${Array.from({ length: OB }, (_, i) => `<i class="${i <= obStep ? "on" : ""}"></i>`).join("")}</div>`;
  const inp = (f, label, type = "text", extra = "") => `<div class="field"><label class="l">${label}</label><input type="${type}" data-f="${f}" data-in="ob" value="${esc(ob[f] ?? "")}" ${extra}></div>`;
  const body = [
    `<p class="title">~/setup <b>--perfil</b></p><h1>Construyamos tu base.</h1>${inp("name", "nombre", "text", 'autocomplete="given-name"')}
      <div class="field"><label class="l">sexo (metabolismo basal)</label><div class="pickgrid">${pick("sex", "f", "Mujer")}${pick("sex", "m", "Hombre")}</div></div>${inp("birth", "nacimiento", "date")}`,
    `<p class="title">~/setup <b>--cuerpo</b></p><h1>Datos actuales</h1><div class="g2">${inp("height", "altura cm", "number", 'inputmode="decimal"')}${inp("weight", "peso kg", "number", 'inputmode="decimal"')}</div>
      <div class="field"><label class="l">actividad</label><select data-f="activity" data-in="ob">${[["sedentario", "Sedentaria"], ["ligero", "Ligera (1-3 d/sem)"], ["moderado", "Moderada (3-5 d/sem)"], ["activo", "Activa (6-7 d/sem)"], ["muy_activo", "Muy activa"]].map(([v, t]) => `<option value="${v}" ${ob.activity === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="panel" id="obBmi"></div>`,
    `<p class="title">~/setup <b>--meta</b></p><h1>¿A dónde vamos?</h1><div class="field"><label class="l">objetivo</label><div class="pickgrid">${pick("goalType", "bajar", "Bajar de peso")}${pick("goalType", "tonificar", "Tonificar")}${pick("goalType", "mantener", "Mantener")}${pick("goalType", "subir", "Ganar músculo")}</div></div>
      ${inp("goalWeight", "peso meta kg", "number", 'inputmode="decimal"')}<div class="panel" id="obRange"></div>`,
    `<p class="title">~/setup <b>--ciclo</b></p><h1>Entrena con tus fases</h1><p class="dim" style="margin:0">Activa el seguimiento para recibir frases y tips según tu fase.</p>
      <div class="pickgrid">${pick("cycle", "yes", "Sí")}${pick("cycle", "no", "Ahora no")}</div>
      ${ob.cycle === "yes" ? `${inp("last", "último inicio", "date")}<div class="g2">${inp("cycleLen", "ciclo (días)", "number")}${inp("periodLen", "periodo (días)", "number")}</div>` : ""}`,
    `<p class="title">~/setup <b>--preview</b></p><h1>Ahora → meta</h1><div class="panel">${simPreview()}</div>`,
  ][obStep];
  showGate(`${steps}${body}<div class="err" id="obErr"></div><div class="nav"><button class="btn" data-act="ob-back" style="visibility:${obStep ? "visible" : "hidden"}">atrás</button><button class="btn primary" data-act="ob-next">${obStep === OB - 1 ? "empezar" : "siguiente"}</button></div>`);
  obHints();
}
function simPreview() {
  const h = +ob.height, w = +ob.weight, g = +ob.goalWeight || w;
  return simCard({ weightKg: w, goalWeightKg: g, heightCm: h }, 100);
}
function obHints() {
  const h = +ob.height, w = +ob.weight;
  if (obStep === 1 && h && w) $("#obBmi").innerHTML = `<span class="mono small">IMC <b class="pink">${bmi(w, h).toFixed(1)}</b> · ${bmiCategory(bmi(w, h))}</span>`;
  if (obStep === 2 && h) { const [a, b] = healthyRange(h); $("#obRange").innerHTML = `<span class="mono small dim">rango saludable estimado para tu altura: <b class="violet">${a.toFixed(0)}–${b.toFixed(0)} kg</b></span>`; }
}
inputs.ob = (el) => { ob[el.dataset.f] = el.value; if (el.tagName === "SELECT") return; obHints(); };
actions["ob-pick"] = (el) => { ob[el.dataset.f] = el.dataset.v; renderOb(); };
actions["ob-back"] = () => { if (obStep) { collectOb(); obStep--; renderOb(); } };
const collectOb = () => $$(".gate [data-f]").forEach((i) => { if (i.tagName === "INPUT" || i.tagName === "SELECT") ob[i.dataset.f] = i.value; });
actions["ob-next"] = () => {
  collectOb();
  const bad = (m) => { $("#obErr").textContent = m; };
  if (obStep === 0 && (!ob.name?.trim() || !ob.birth)) return bad("Completa nombre y fecha de nacimiento.");
  if (obStep === 1 && (!(+ob.height > 100 && +ob.height < 230) || !(+ob.weight > 25 && +ob.weight < 300))) return bad("Revisa altura (cm) y peso (kg).");
  if (obStep === 2 && !(+ob.goalWeight > 25)) return bad("Indica tu peso meta en kg.");
  if (obStep === OB - 1) return finishOb();
  obStep++; renderOb();
};
function finishOb() {
  const w = +ob.weight;
  state.profile = {
    name: ob.name.trim(), sex: ob.sex, birthDate: ob.birth, heightCm: +ob.height, weightKg: w, startWeightKg: w,
    activity: ob.activity, goalType: ob.goalType, goalWeightKg: +ob.goalWeight, stepsGoal: 8000, restSec: 90,
    cycleEnabled: ob.cycle === "yes", lastPeriodStart: ob.cycle === "yes" ? ob.last || todayISO() : null,
    cycleLength: +ob.cycleLen || 28, periodLength: +ob.periodLen || 5, createdAt: new Date().toISOString(),
  };
  store.addWeight(todayISO(), w);
  store.touchProfile(); store.saveNow();
  confetti(); startApp();
}

function startApp() {
  hideGate(); appStarted = true;
  goto(location.hash.slice(1) || "hoy");
}

/* ---------------- command palette ---------------- */
let palItems = [], palSel = 0;
function paletteBuild(q) {
  const nq = norm(q.trim());
  const nav = [["hoy", "→", "ir a hoy"], ["log", "→", "ir a log (comida, agua, pasos, peso)"], ["gym", "→", "ir a gym"], ["ciclo", "→", "ir a ciclo"], ["yo", "→", "ir a yo (ajustes, sync)"]]
    .map(([v, ic, t]) => ({ ic, t, k: v, run: () => goto(v) }));
  const rts = state.routines.map((r) => ({ ic: ">", t: `empezar: ${r.name}`, k: r.tag || "rutina", run: () => startSession(r) }));
  const free = [{ ic: ">", t: "sesión libre", k: "gym", run: () => startSession(null) }];
  const quick = [
    { ic: "+", t: "agua 250 ml", k: "hoy", run: () => actions["q-water"]({ dataset: { ml: 250 } }) },
    { ic: "+", t: "1,000 pasos", k: "hoy", run: () => actions["q-steps"]({ dataset: { n: 1000 } }) },
    { ic: "+", t: "registrar peso", k: "log", run: () => actions["q-weight"]() },
  ];
  const foods = nq.length >= 2 ? FOOD_DB.filter((f) => norm(f.name).includes(nq)).slice(0, 6).map((f) => ({ ic: "🍽", t: `comida: ${f.name}`, k: "log", run: () => { focusFood(f.name); meta.currentDay = todayISO(); goto("log"); } })) : [];
  const all = [...(hasSession() ? [{ ic: "▶", t: "volver a la sesión", k: "gym", run: () => resumeSession() }] : []), ...rts, ...free, ...nav, ...quick, ...foods];
  return nq ? all.filter((i) => norm(i.t).includes(nq) || norm(i.k).includes(nq)) : all.slice(0, 12);
}
function paletteDraw() {
  $(".pal-list").innerHTML = palItems.length ? palItems.map((it, i) => `<div class="pal-item ${i === palSel ? "sel" : ""}" data-act="pal-run" data-i="${i}"><span class="ic">${it.ic}</span><span>${esc(it.t)}</span><span class="k">${esc(it.k)}</span></div>`).join("") : '<div class="empty">sin resultados</div>';
}
function openPalette() {
  ov().className = "on";
  ov().innerHTML = `<div class="palette" data-act="pal-close"><div class="pal"><input type="text" id="palQ" placeholder="> buscar rutina, alimento o pantalla" data-live="pal-q" autocomplete="off"><div class="pal-list"></div></div></div>`;
  palItems = paletteBuild(""); palSel = 0; paletteDraw(); $("#palQ").focus();
}
actions.palette = openPalette;
actions["pal-close"] = (el, e) => { if (e && el && e.target !== el) return; ov().className = ""; ov().innerHTML = ""; };
actions["pal-run"] = (el) => { const it = palItems[+el.dataset.i]; actions["pal-close"](); it?.run(); };
inputs["pal-q"] = (el) => { palItems = paletteBuild(el.value); palSel = 0; paletteDraw(); };
document.addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (e.key === "/" && !typing && state.profile) { e.preventDefault(); openPalette(); return; }
  if ($("#palQ")) {
    if (e.key === "Escape") actions["pal-close"]();
    else if (e.key === "ArrowDown") { palSel = Math.min(palItems.length - 1, palSel + 1); paletteDraw(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { palSel = Math.max(0, palSel - 1); paletteDraw(); e.preventDefault(); }
    else if (e.key === "Enter") { const it = palItems[palSel]; actions["pal-close"](); it?.run(); }
  }
});

/* ---------------- YO ---------------- */
function renderYo() {
  const p = state.profile, b = bmi(p.weightKg, p.heightCm), [lo, hi] = healthyRange(p.heightCm), gb = bmi(p.goalWeightKg, p.heightCm);
  const MODE = { synced: "sincronizado", syncing: "sincronizando…", offline: "sin conexión (se guarda local)", "signed-out": "sin sesión", local: "solo este dispositivo", init: "iniciando" };
  const note = gb < 17 ? "Tu meta queda por debajo del rango típico saludable. Si puedes, coméntalo con un profesional." : gb > 32 ? "Tu meta queda por encima del rango típico saludable. Considera ajustarla o consultarlo." : "";
  $('[data-view="yo"]').innerHTML = `
    <div><p class="title">~/yo <b>--config</b></p><h1>Ajustes</h1></div>
    <div class="panel"><div class="ph"><b>sync</b><span class="mono ${status.mode === "synced" ? "pink" : status.mode === "offline" ? "red" : "violet"}">● ${MODE[status.mode] || status.mode}</span></div>
      <div class="mono small dim">${status.user ? esc(status.user.email) : "sin cuenta conectada"}${status.pending ? ` · ${status.pending} cambio(s) pendiente(s)` : ""}</div>
      ${status.error ? `<div class="err" style="margin-top:6px">${esc(status.error)}</div>` : ""}
      <div class="row wrap" style="margin-top:12px">${status.user ? '<button class="btn sm" data-act="sync-now">sincronizar ahora</button><button class="btn sm danger" data-act="a-out">cerrar sesión</button>' : '<button class="btn sm primary" data-act="a-show">iniciar sesión</button>'}</div></div>
    <div class="panel"><div class="ph"><b>cuerpo</b><span class="mono">IMC ${b.toFixed(1)} · ${bmiCategory(b)}</span></div>
      <div class="mono small dim" style="margin-bottom:10px">rango saludable para tu altura: <b class="violet">${lo.toFixed(0)}–${hi.toFixed(0)} kg</b></div>${simCard(p, 100)}${note ? `<p class="small dim" style="margin:10px 0 0">${note}</p>` : ""}</div>
    <div class="panel col"><div class="ph" style="margin:0"><b>perfil</b></div>
      <div class="field"><label class="l">nombre</label><input type="text" id="pN" value="${esc(p.name)}"></div>
      <div class="g2"><div class="field"><label class="l">altura cm</label><input type="number" id="pH" value="${p.heightCm}" inputmode="decimal"></div><div class="field"><label class="l">peso kg</label><input type="number" id="pW" value="${p.weightKg}" inputmode="decimal" step="0.1"></div></div>
      <div class="g2"><div class="field"><label class="l">objetivo</label><select id="pG">${[["bajar", "Bajar de peso"], ["tonificar", "Tonificar"], ["mantener", "Mantener"], ["subir", "Ganar músculo"]].map(([v, t]) => `<option value="${v}" ${p.goalType === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label class="l">peso meta kg</label><input type="number" id="pGW" value="${p.goalWeightKg}" inputmode="decimal" step="0.1"></div></div>
      <div class="g2"><div class="field"><label class="l">meta de pasos</label><input type="number" id="pS" value="${p.stepsGoal || 8000}"></div>
        <div class="field"><label class="l">actividad</label><select id="pA">${[["sedentario", "Sedentaria"], ["ligero", "Ligera"], ["moderado", "Moderada"], ["activo", "Activa"], ["muy_activo", "Muy activa"]].map(([v, t]) => `<option value="${v}" ${p.activity === v ? "selected" : ""}>${t}</option>`).join("")}</select></div></div>
      <div class="field"><label class="l">descanso entre series</label><div class="row wrap" style="gap:8px">${[45, 60, 90, 120, 180].map((s) => `<button class="chip ${(p.restSec || 90) === s ? "on" : ""}" data-act="rest-pref" data-s="${s}">${s}s</button>`).join("")}</div></div>
      <button class="btn primary block" data-act="p-save">guardar cambios</button></div>
    <div class="panel col"><div class="ph" style="margin:0"><b>respaldo</b></div>
      <p class="small dim" style="margin:0">Tus datos viven en Supabase. Aquí puedes exportar una copia o importar el respaldo de la versión anterior de la app.</p>
      <button class="btn block" data-act="exp">exportar respaldo (.json)</button><button class="btn block ghost" data-act="imp">importar respaldo</button>
      <input type="file" accept="application/json" class="hidden-file" id="impFile" data-in="imp-file"></div>
    <div class="panel"><button class="btn danger block" data-act="wipe">borrar datos de este dispositivo</button></div>`;
}
Object.assign(actions, {
  "a-show": () => showLogin(),
  "a-out": async () => { await store.signOut(); toast("Sesión cerrada"); renderYo(); },
  "sync-now": async () => { toast("Sincronizando…"); try { await store.pull(); await store.flush(); renderCurrent(); toast("Listo"); } catch (e) { toast("Sin conexión", "err"); } },
  "rest-pref": (el) => { state.profile.restSec = +el.dataset.s; store.touchProfile(); renderYo(); },
  "p-save": () => {
    const p = state.profile, n = (id) => parseFloat($(id).value);
    p.name = $("#pN").value.trim() || p.name; p.heightCm = n("#pH") || p.heightCm; p.goalType = $("#pG").value;
    p.goalWeightKg = n("#pGW") || p.goalWeightKg; p.stepsGoal = parseInt($("#pS").value, 10) || 8000; p.activity = $("#pA").value;
    const w = n("#pW"); if (w && w !== p.weightKg) store.addWeight(todayISO(), w);
    store.touchProfile(); toast("Perfil guardado"); renderYo();
  },
  exp: () => {
    const blob = new Blob([store.exportJSON()], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `mfc-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  imp: () => $("#impFile").click(),
  wipe: () => {
    if (!confirm("Esto borra los datos guardados en este dispositivo (no los de la nube). ¿Continuar?")) return;
    ["mfc2_state", "mfc2_outbox", "mfc2_meta"].forEach((k) => localStorage.removeItem(k)); location.reload();
  },
});
inputs["imp-file"] = (el) => {
  const f = el.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const obj = JSON.parse(r.result); if (!confirm("Esto reemplaza tus datos actuales con los del respaldo. ¿Continuar?")) return; store.importBackup(obj); toast("Respaldo importado"); startApp(); }
    catch { toast("Ese archivo no parece un respaldo válido", "err"); }
  };
  r.readAsText(f);
};

/* ---------------- boot ---------------- */
async function boot() {
  store.load(); bindDelegation(); store.onStatus(() => { updateSync(); if (current === "yo" && appStarted) renderYo(); });
  updateSync();
  if (state.profile) startApp();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  await store.initSync();
  updateSync();
  if (state.profile) { if (!appStarted) startApp(); else renderCurrent(); return; }
  if (status.user || meta.localOnly) showOnboarding();
  else showLogin(status.mode === "offline" ? "Sin conexión: puedes usar la app solo en este dispositivo y sincronizar después." : "");
}
boot();
