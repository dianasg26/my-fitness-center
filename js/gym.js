import { state, touchSession, saveRoutine, deleteRoutine, addGymLog, saveNow } from "./store.js";
import { $, esc, uid, todayISO, fmtDate, fmtDur, kgStr, actions, inputs, toast, confetti, haptic, beep, weekdayName } from "./util.js";
import { muscleFor, TAGS, EXERCISE_NAMES } from "./data.js";
import { muscleFigure, muscleText } from "./figures.js";

const view = () => $('[data-view="gym"]');
const app = () => $("#app");
let minimized = false;
let draft = null; // routine being edited

/* ---------------- helpers ---------------- */
const isCardio = (name) => muscleFor(name).p.includes("cardio");
const parseReps = (t) => { const m = String(t || "").match(/\d+/); return m ? +m[0] : 10; };
const restDefault = () => state.profile?.restSec || 90;

function history(name) {
  return state.gym.filter((g) => g.exercise === name).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
const bestKg = (name) => history(name).reduce((m, g) => Math.max(m, ...g.sets.map((s) => +s.kg || 0)), 0);
const setStr = (s, cardio) => (cardio ? `${s.reps}min` : `${kgStr(s.kg)}×${s.reps}`);

export const routineMuscles = (r) => {
  const p = new Set(), s = new Set();
  r.exercises.forEach((e) => { const m = muscleFor(e.name); m.p.forEach((x) => p.add(x)); m.s.forEach((x) => s.add(x)); });
  return { p: [...p], s: [...s].filter((x) => !p.has(x)) };
};
export const todayRoutine = () => state.routines.find((r) => r.tag === weekdayName());

/* ---------------- session lifecycle ---------------- */
let wl = null;
async function lockScreen() { try { wl = await navigator.wakeLock?.request("screen"); } catch { /* not allowed */ } }
function unlockScreen() { try { wl?.release?.(); } catch { /* noop */ } wl = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session && !minimized) lockScreen(); });

export function startSession(routine) {
  const items = (routine?.exercises || []).map((e) => mkItem(e.name, e.sets || 3, e.reps, e.rest));
  state.session = { id: uid(), routineId: routine?.id || null, name: routine?.name || "Sesión libre", startedAt: Date.now(), items, cur: 0, rest: null };
  minimized = false;
  touchSession(); lockScreen();
  window.dispatchEvent(new CustomEvent("mfc:goto", { detail: "gym" }));
}
function mkItem(name, n, target, rest) {
  const last = history(name)[0]?.sets;
  const sets = Array.from({ length: n || 3 }, (_, i) => {
    const ls = last ? last[Math.min(i, last.length - 1)] : null;
    return { kg: ls ? +ls.kg : 0, reps: ls ? +ls.reps : parseReps(target), done: false };
  });
  return { id: uid(), name, target: target || "", rest: rest || restDefault(), sets, skipped: false };
}
export const hasSession = () => !!state.session;
export function setMinimized(v) { minimized = v; syncShell(); }
export function resumeSession() { minimized = false; lockScreen(); window.dispatchEvent(new CustomEvent("mfc:goto", { detail: "gym" })); }
export const sessionProgress = () => {
  const s = state.session; if (!s) return null;
  const act = s.items.filter((i) => !i.skipped);
  return { done: act.filter((i) => i.sets.every((x) => x.done)).length, total: act.length, elapsed: (Date.now() - s.startedAt) / 1000 };
};

function syncShell() {
  const on = !!state.session && !minimized;
  app().classList.toggle("session-on", on);
  if (!on) $("#dock").innerHTML = "";
}

const cur = () => state.session.items[state.session.cur];
const nextUndoneIdx = () => {
  const items = state.session.items, n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (state.session.cur + k) % n, it = items[i];
    if (!it.skipped && it.sets.some((s) => !s.done)) return i;
  }
  return -1;
};
const allDone = () => state.session.items.every((i) => i.skipped || i.sets.every((s) => s.done));

function logSet(item, idx) {
  const st = item.sets[idx];
  st.done = !st.done;
  if (!st.done) { touchSession(); return render(); }
  haptic(18);
  const s = state.session, restS = item.rest || restDefault();
  s.rest = { endsAt: Date.now() + restS * 1000, total: restS, fired: false };
  const hist = bestKg(item.name);
  const others = Math.max(0, ...item.sets.filter((x, j) => x.done && j !== idx).map((x) => +x.kg || 0));
  st.pr = !isCardio(item.name) && hist > 0 && +st.kg > Math.max(hist, others);
  if (st.pr) { confetti(14); toast(`PR en ${item.name}: ${kgStr(st.kg)}kg`); haptic([30, 40, 30]); }
  if (item.sets.every((x) => x.done)) {
    if (allDone()) { s.rest = null; confetti(26); toast("Rutina completa. Dale a finalizar."); }
    else { const n = nextUndoneIdx(); if (n >= 0) s.cur = n; }
  }
  touchSession(); render();
}

/* ---------------- rendering ---------------- */
export function renderGym() {
  const el = view();
  syncShell();
  if (state.session) { renderSession(el); renderDock(); startTick(); } else { stopTick(); unlockScreen(); renderRoutines(el); }
}
const render = renderGym;

function renderRoutines(el) {
  const order = (r) => { const i = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].indexOf(r.tag); return i < 0 ? 99 : i; };
  const rs = [...state.routines].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  const today = weekdayName();
  const prs = {};
  state.gym.forEach((g) => g.sets.forEach((s) => { prs[g.exercise] = Math.max(prs[g.exercise] || 0, +s.kg || 0); }));
  const prList = Object.entries(prs).filter(([n, v]) => v > 0 && !isCardio(n)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const logs = [...state.gym].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);

  el.innerHTML = `
    <div class="row between"><div><p class="title">~/gym <b>--rutinas</b></p><h1>Entrena</h1></div>
      <button class="btn sm" data-act="r-new">+ carpeta</button></div>
    ${rs.length ? rs.map((r) => {
      const m = routineMuscles(r);
      return `<article class="panel rt" ${r.tag === today ? 'style="border-color:var(--pink-d)"' : ""}>
        <div class="rt-top"><div><div class="rt-name">${esc(r.name)}</div>${r.tag ? `<span class="tag">${esc(r.tag)}${r.tag === today ? " · hoy" : ""}</span>` : ""}</div>
          <div class="row" style="gap:6px"><button class="iconbtn" data-act="r-edit" data-id="${r.id}" aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="iconbtn" data-act="r-del" data-id="${r.id}" aria-label="Borrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
        <div class="rt-body">${muscleFigure(m, 70)}<div class="rt-ex grow">${r.exercises.map((e) => `${esc(e.name)} <span>${e.sets}×${esc(e.reps)}</span>`).join("<br>")}</div></div>
        <button class="btn primary block" data-act="r-start" data-id="${r.id}">&gt; empezar rutina</button>
      </article>`;
    }).join("") : `<div class="panel flat"><div class="empty">Aún no tienes rutinas. Crea una carpeta (ej. "Pierna" con etiqueta Lunes).</div></div>`}
    <button class="btn block" data-act="r-free">sesión libre (sin carpeta)</button>
    ${prList.length ? `<div class="panel"><div class="ph"><b>récords</b><span>kg máx</span></div><div class="row wrap" style="gap:6px">${prList.map(([n, v]) => `<span class="tag pr">${esc(n)} ${kgStr(v)}</span>`).join("")}</div></div>` : ""}
    <div class="panel"><div class="ph"><b>historial</b></div>
      ${logs.length ? logs.map((g) => `<div class="li"><div><div class="t">${esc(g.exercise)}</div><div class="d">${fmtDate(g.date, { day: "numeric", month: "short" })}${g.folderTag ? " · " + esc(g.folderTag) : ""}</div></div><div class="v">${g.sets.map((s) => setStr(s, isCardio(g.exercise))).join(" ")}</div></div>`).join("") : '<div class="empty">sin sesiones todavía</div>'}
    </div>`;
}

function renderSession(el) {
  const s = state.session, p = sessionProgress(), item = cur();
  const vol = s.items.reduce((a, i) => a + i.sets.filter((x) => x.done).reduce((b, x) => b + (+x.kg || 0) * (+x.reps || 0), 0), 0);
  const sets = s.items.reduce((a, i) => a + i.sets.filter((x) => x.done).length, 0);
  el.innerHTML = `
    <div class="sess-head">
      <div class="row between"><div class="grow"><p class="title">~/gym <b>--sesión</b></p><h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</h2></div>
        <button class="btn sm ghost" data-act="s-min">minimizar</button></div>
      <div class="sess-stats" style="margin-top:6px"><span>⏱ <b id="sElapsed">${fmtDur(p.elapsed)}</b></span><span><b>${p.done}/${p.total}</b> ej</span><span><b>${sets}</b> series</span><span><b>${Math.round(vol)}</b> kg vol</span></div>
      <div class="exnav">${s.items.map((it, i) => `<button class="${i === s.cur ? "cur" : ""} ${it.skipped ? "skip" : it.sets.every((x) => x.done) ? "done" : ""}" data-act="s-go" data-i="${i}">${esc(it.name)}</button>`).join("")}</div>
    </div>
    ${item ? exerciseCard(item) : '<div class="panel flat"><div class="empty">Agrega un ejercicio para empezar.</div></div>'}
    <div class="panel"><div class="ph"><b>agregar ejercicio</b></div>
      <div class="row"><input type="text" id="sAddName" list="exList" placeholder="Ej. Curl de bíceps" autocomplete="off"><button class="btn" data-act="s-add">+</button></div></div>
    <datalist id="exList">${EXERCISE_NAMES.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="g2"><button class="btn danger" data-act="s-cancel">descartar</button><button class="btn primary" data-act="s-finish">finalizar</button></div>`;
}

function exerciseCard(item) {
  const m = muscleFor(item.name), mt = muscleText(m), cardio = m.p.includes("cardio");
  const hist = history(item.name), last = hist[0]?.sets, best = bestKg(item.name);
  const nextIdx = item.sets.findIndex((x) => !x.done);
  return `<article class="panel exc ${item.skipped ? "skip" : ""}">
    <div class="exc-head">
      ${muscleFigure(m, 96)}
      <div class="grow"><div class="exc-name">${esc(item.name)}</div>
        <div class="exc-meta">${item.target ? `meta <b>${item.sets.length}×${esc(item.target)}</b><br>` : ""}${last ? `última vez <b>${last.map((x) => setStr(x, cardio)).join(" ")}</b><br>` : "primera vez 🎯<br>"}${best > 0 && !cardio ? `récord <b>${kgStr(best)}kg</b><br>` : ""}${mt.p ? `objetivo <b>${mt.p}</b>` : ""}${mt.s ? `<br><span class="faint">apoyo ${mt.s}</span>` : ""}</div></div>
    </div>
    <div class="sets">${item.sets.map((x, i) => `
      <div class="setrow ${x.done ? "done" : i === nextIdx ? "next" : ""}"><span class="n">${i + 1}</span>
        ${stepper(i, "kg", x.kg, cardio ? "nivel" : "kg", cardio ? 1 : 2.5)}${stepper(i, "reps", x.reps, cardio ? "min" : "reps", 1)}
        <button class="chk ${x.done ? "on" : ""}" data-act="s-set" data-s="${i}" aria-label="Marcar serie ${i + 1}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button></div>
      ${x.pr ? '<div style="text-align:right;margin-top:-4px"><span class="tag pr">PR</span></div>' : ""}`).join("")}</div>
    <div class="exc-foot">
      <button class="btn sm" data-act="s-addset">+ serie</button>
      ${item.sets.length > 1 ? '<button class="btn sm ghost" data-act="s-delset">− serie</button>' : ""}
      <button class="btn sm ghost" data-act="s-skip">${item.skipped ? "deshacer salto" : "saltar"}</button>
      <button class="btn sm danger" data-act="s-remove">quitar</button></div>
  </article>`;
}
const stepper = (i, f, val, unit, step) => `<div class="stepper"><button data-act="s-step" data-s="${i}" data-f="${f}" data-d="${-step}" aria-label="menos">−</button>
  <div class="val"><input type="number" inputmode="decimal" step="any" data-in="s-val" data-s="${i}" data-f="${f}" value="${kgStr(val)}"><span class="u">${unit}</span></div>
  <button data-act="s-step" data-s="${i}" data-f="${f}" data-d="${step}" aria-label="más">+</button></div>`;

function renderDock() {
  const s = state.session, item = cur();
  let btn;
  if (allDone()) btn = `<button class="btn primary big" data-act="s-finish">■ finalizar rutina</button>`;
  else if (!item) btn = "";
  else {
    const i = item.sets.findIndex((x) => !x.done);
    if (item.skipped) btn = `<button class="btn primary big" data-act="s-next">siguiente ejercicio →</button>`;
    else if (i < 0) btn = `<button class="btn primary big" data-act="s-next">siguiente: ${esc(state.session.items[nextUndoneIdx()]?.name || "")} →</button>`;
    else { const x = item.sets[i], cardio = isCardio(item.name); btn = `<button class="btn primary big" data-act="s-log">✓ serie ${i + 1}/${item.sets.length} · ${cardio ? x.reps + " min" : kgStr(x.kg) + "kg × " + x.reps}</button>`; }
  }
  $("#dock").innerHTML = `${s.rest ? `<div class="rest" id="restBox"><div class="bar" id="restBar"></div><span class="t" id="restT">--:--</span><span class="lbl">descanso</span>
    <button class="chip" data-act="rest-add" data-d="-15">−15</button><button class="chip" data-act="rest-add" data-d="15">+15</button><button class="chip" data-act="rest-skip">skip</button></div>` : ""}${btn}`;
  tick();
}

let timer = null;
function startTick() { if (!timer) timer = setInterval(tick, 250); }
function stopTick() { clearInterval(timer); timer = null; }
function tick() {
  const s = state.session; if (!s) return;
  const e = $("#sElapsed"); if (e) e.textContent = fmtDur((Date.now() - s.startedAt) / 1000);
  const r = s.rest, box = $("#restBox"); if (!r || !box) return;
  const left = (r.endsAt - Date.now()) / 1000;
  $("#restT").textContent = left > 0 ? fmtDur(Math.ceil(left)) : "¡ya!";
  $("#restBar").style.width = Math.max(0, Math.min(100, (1 - left / r.total) * 100)) + "%";
  box.classList.toggle("over", left <= 0);
  if (left <= 0 && !r.fired) { r.fired = true; haptic([200, 100, 200]); beep(880, 160); setTimeout(() => beep(1175, 200), 200); touchSession(); }
}

/* ---------------- session actions ---------------- */
Object.assign(actions, {
  "s-go": (el) => { state.session.cur = +el.dataset.i; touchSession(); render(); },
  "s-set": (el) => logSet(cur(), +el.dataset.s),
  "s-log": () => { const it = cur(), i = it.sets.findIndex((x) => !x.done); if (i >= 0) logSet(it, i); },
  "s-next": () => { const n = nextUndoneIdx(); if (n >= 0) { state.session.cur = n; touchSession(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); } },
  "s-step": (el) => {
    const it = cur(), st = it.sets[+el.dataset.s], f = el.dataset.f;
    st[f] = Math.max(0, Math.round(((+st[f] || 0) + +el.dataset.d) * 100) / 100); haptic(6);
    // propagate the change to the following not-done sets (typical: same weight all sets)
    it.sets.slice(+el.dataset.s + 1).forEach((x) => { if (!x.done) x[f] = st[f]; });
    touchSession(); render();
  },
  "s-addset": () => { const it = cur(), l = it.sets.at(-1); it.sets.push({ kg: l?.kg || 0, reps: l?.reps || 10, done: false }); touchSession(); render(); },
  "s-delset": () => { const it = cur(); if (it.sets.length > 1) { it.sets.pop(); touchSession(); render(); } },
  "s-skip": () => { const it = cur(); it.skipped = !it.skipped; if (it.skipped) { const n = nextUndoneIdx(); if (n >= 0) state.session.cur = n; } touchSession(); render(); },
  "s-remove": () => { const s = state.session; s.items.splice(s.cur, 1); s.cur = Math.max(0, Math.min(s.cur, s.items.length - 1)); touchSession(); render(); },
  "s-add": () => {
    const inp = $("#sAddName"), name = inp.value.trim(); if (!name) return;
    const s = state.session; s.items.push(mkItem(name, 3, "", 0)); s.cur = s.items.length - 1; touchSession(); render();
  },
  "s-min": () => { setMinimized(true); window.dispatchEvent(new CustomEvent("mfc:goto", { detail: "hoy" })); },
  "s-cancel": () => { if (!confirm("¿Descartar la sesión sin guardar?")) return; state.session = null; minimized = false; touchSession(); unlockScreen(); render(); },
  "s-finish": () => finishSheet(),
  "rest-add": (el) => { const r = state.session.rest; if (!r) return; r.endsAt += +el.dataset.d * 1000; r.total = Math.max(5, r.total + +el.dataset.d); r.fired = false; touchSession(); tick(); },
  "rest-skip": () => { state.session.rest = null; touchSession(); renderDock(); },
});
inputs["s-val"] = (el) => {
  const it = cur(), st = it.sets[+el.dataset.s], v = Math.max(0, parseFloat(String(el.value).replace(",", ".")) || 0);
  st[el.dataset.f] = v; it.sets.slice(+el.dataset.s + 1).forEach((x) => { if (!x.done) x[el.dataset.f] = v; });
  touchSession(); render();
};

function finishSheet() {
  const s = state.session;
  const done = s.items.filter((i) => !i.skipped && i.sets.some((x) => x.done));
  const sets = done.reduce((a, i) => a + i.sets.filter((x) => x.done).length, 0);
  const vol = done.reduce((a, i) => a + i.sets.filter((x) => x.done).reduce((b, x) => b + (+x.kg || 0) * (+x.reps || 0), 0), 0);
  const prs = done.reduce((a, i) => a + i.sets.filter((x) => x.pr).length, 0);
  const ov = $("#overlay");
  ov.className = "on";
  ov.innerHTML = `<div class="scrim" data-act="close-ov"></div><div class="sheet">
    <p class="title">~/gym <b>--finish</b></p><h2 style="margin-top:4px">¿Terminamos?</h2>
    <div class="summary-grid"><div><b>${fmtDur((Date.now() - s.startedAt) / 1000)}</b><span>tiempo</span></div><div><b>${sets}</b><span>series</span></div><div><b>${Math.round(vol)}</b><span>kg volumen</span></div></div>
    ${prs ? `<p class="pink mono small">★ ${prs} récord(s) personal(es) hoy</p>` : ""}
    ${done.length ? "" : '<p class="dim small mono">// no marcaste ninguna serie: no se guardará nada.</p>'}
    <div class="g2" style="margin-top:12px"><button class="btn" data-act="close-ov">seguir</button><button class="btn primary" data-act="s-save">guardar</button></div></div>`;
}
actions["s-save"] = () => {
  const s = state.session, date = todayISO();
  let n = 0;
  s.items.forEach((it) => {
    if (it.skipped) return;
    const sets = it.sets.filter((x) => x.done).map((x) => ({ reps: +x.reps || 0, kg: +x.kg || 0 }));
    if (sets.length) { addGymLog({ id: uid(), date, exercise: it.name, sets, notes: "", folderTag: s.name }); n++; }
  });
  state.session = null; minimized = false; touchSession(); saveNow(); unlockScreen();
  actions["close-ov"]();
  if (n) { confetti(30); toast(`Sesión guardada · ${n} ejercicio(s)`); }
  window.dispatchEvent(new CustomEvent("mfc:goto", { detail: "gym" }));
};
actions["close-ov"] = () => { const ov = $("#overlay"); ov.className = ""; ov.innerHTML = ""; };

/* ---------------- routine CRUD ---------------- */
actions["r-start"] = (el) => startSession(state.routines.find((r) => r.id === el.dataset.id));
actions["r-free"] = () => startSession(null);
actions["r-new"] = () => openEditor({ id: null, name: "", tag: "", exercises: [{ name: "", sets: 3, reps: "10-12" }] });
actions["r-edit"] = (el) => openEditor(JSON.parse(JSON.stringify(state.routines.find((r) => r.id === el.dataset.id))));
actions["r-del"] = (el) => {
  const r = state.routines.find((x) => x.id === el.dataset.id);
  if (r && confirm(`¿Borrar la carpeta "${r.name}"?`)) { deleteRoutine(r.id); render(); }
};

function openEditor(r) {
  draft = r; paintEditor();
}
function paintEditor() {
  const ov = $("#overlay"); ov.className = "on";
  ov.innerHTML = `<div class="scrim" data-act="close-ov"></div><div class="sheet">
    <p class="title">~/gym <b>${draft.id ? "--edit" : "--new"}</b></p><h2 style="margin:4px 0 14px">${draft.id ? "Editar carpeta" : "Nueva carpeta"}</h2>
    <div class="field" style="margin-bottom:12px"><label class="l">nombre</label><input type="text" data-in="r-name" value="${esc(draft.name)}" placeholder="Ej. Pierna y glúteo"></div>
    <label class="l">etiqueta (día o grupo)</label>
    <div class="scroll-x" style="margin-bottom:14px">${TAGS.map((t) => `<button class="chip ${draft.tag === t ? "on" : ""}" data-act="r-tag" data-t="${t}">${t}</button>`).join("")}</div>
    <label class="l">ejercicios · series · reps</label>
    <div class="col" style="gap:8px">${draft.exercises.map((e, i) => `<div class="exrow">
      <input type="text" list="exList2" data-in="r-ex" data-i="${i}" data-f="name" value="${esc(e.name)}" placeholder="Ejercicio" autocomplete="off">
      <input type="number" inputmode="numeric" data-in="r-ex" data-i="${i}" data-f="sets" value="${e.sets}" aria-label="series">
      <input type="text" data-in="r-ex" data-i="${i}" data-f="reps" value="${esc(e.reps)}" aria-label="repeticiones">
      <button class="iconbtn" data-act="r-exdel" data-i="${i}" aria-label="Quitar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join("")}</div>
    <datalist id="exList2">${EXERCISE_NAMES.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <button class="btn sm" style="margin:10px 0 16px" data-act="r-exadd">+ ejercicio</button>
    <div class="g2"><button class="btn" data-act="close-ov">cancelar</button><button class="btn primary" data-act="r-save">guardar</button></div></div>`;
}
actions["r-tag"] = (el) => { draft.tag = draft.tag === el.dataset.t ? "" : el.dataset.t; paintEditor(); };
actions["r-exadd"] = () => { draft.exercises.push({ name: "", sets: 3, reps: "10-12" }); paintEditor(); };
actions["r-exdel"] = (el) => { draft.exercises.splice(+el.dataset.i, 1); if (!draft.exercises.length) draft.exercises.push({ name: "", sets: 3, reps: "10-12" }); paintEditor(); };
inputs["r-name"] = (el) => { draft.name = el.value; };
inputs["r-ex"] = (el) => { const e = draft.exercises[+el.dataset.i], f = el.dataset.f; e[f] = f === "sets" ? Math.max(1, parseInt(el.value, 10) || 1) : el.value; };
actions["r-save"] = () => {
  const ae = document.activeElement; if (ae?.blur) ae.blur();
  draft.name = draft.name.trim();
  draft.exercises = draft.exercises.filter((e) => e.name.trim()).map((e) => ({ ...e, name: e.name.trim() }));
  if (!draft.name || !draft.exercises.length) { toast("Ponle nombre y al menos un ejercicio", "err"); paintEditor(); return; }
  saveRoutine({ ...draft, id: draft.id || uid() });
  actions["close-ov"](); toast("Carpeta guardada"); draft = null; render();
};

