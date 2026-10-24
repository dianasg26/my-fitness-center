import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_ESM } from "./config.js";
import { todayISO } from "./util.js";

const LS_STATE = "mfc2_state", LS_OUTBOX = "mfc2_outbox", LS_META = "mfc2_meta";

const fresh = () => ({ profile: null, weightLogs: [], days: {}, gym: [], cycles: [], routines: [], session: null });
export const state = fresh();
export const meta = { localOnly: false, currentDay: todayISO() };
export const status = { mode: "init", pending: 0, user: null, error: "", ready: false };

let outbox = {};
let client = null;
const listeners = new Set();
export const onStatus = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((f) => f(status));

/* ---------------- local persistence ---------------- */
export function replaceState(next) {
  const base = fresh();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, base, next || {});
}

export function load() {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (raw) replaceState(JSON.parse(raw));
    outbox = JSON.parse(localStorage.getItem(LS_OUTBOX) || "{}");
    Object.assign(meta, JSON.parse(localStorage.getItem(LS_META) || "{}"));
    meta.currentDay = todayISO();
  } catch { /* corrupted cache: start fresh */ }
  status.pending = Object.keys(outbox).length;
}

let saveTimer;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 120);
}
export function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
    localStorage.setItem(LS_OUTBOX, JSON.stringify(outbox));
    localStorage.setItem(LS_META, JSON.stringify({ localOnly: meta.localOnly }));
  } catch (e) { console.warn("localStorage full?", e); }
  status.pending = Object.keys(outbox).length;
  emit();
}
window.addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveNow(); });

/* ---------------- mutation helpers (mark rows dirty) ---------------- */
export function dirty(kind, key = "_", op = "upsert") {
  outbox[`${kind}:${key}`] = { kind, key, op };
  save();
  scheduleFlush();
}
export const touchProfile = () => dirty("profile");
export const touchDay = (iso) => dirty("day", iso);
export const touchSession = () => dirty("session");

export function getDay(iso) {
  if (!state.days[iso]) state.days[iso] = { foods: [], exerciseKcal: 0, steps: 0, waterMl: 0 };
  return state.days[iso];
}
export function addWeight(date, kg) {
  const e = state.weightLogs.find((w) => w.date === date);
  if (e) e.kg = kg; else state.weightLogs.push({ date, kg });
  const latest = [...state.weightLogs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (state.profile) { state.profile.weightKg = latest.kg; touchProfile(); }
  dirty("weight", date);
}
export function saveRoutine(r) {
  const i = state.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) state.routines[i] = r; else state.routines.push(r);
  dirty("routine", r.id);
}
export function deleteRoutine(id) {
  state.routines = state.routines.filter((r) => r.id !== id);
  dirty("routine", id, "delete");
}
export function addGymLog(log) { state.gym.push(log); dirty("gym", log.id); }
export function addCycle(c) { state.cycles.push(c); dirty("cycle", c.id); }

export function markAll() {
  if (state.profile) dirty("profile");
  state.weightLogs.forEach((w) => dirty("weight", w.date));
  Object.keys(state.days).forEach((d) => dirty("day", d));
  state.routines.forEach((r) => dirty("routine", r.id));
  state.gym.forEach((g) => dirty("gym", g.id));
  state.cycles.forEach((c) => dirty("cycle", c.id));
  dirty("session");
}

/* ---------------- backup / import ---------------- */
export const exportJSON = () => JSON.stringify({ app: "my-fitness-center", v: 2, exportedAt: new Date().toISOString(), state }, null, 2);

export function importBackup(obj) {
  const src = obj.state || obj; // v2 wrapper or the old single-file app format
  if (!src.profile) throw new Error("sin perfil");
  const routines = src.routines || src.routineFolders || [];
  replaceState({
    profile: src.profile,
    weightLogs: src.weightLogs || [],
    days: src.days || {},
    gym: src.gym || [],
    cycles: src.cycles || [],
    routines: routines.map((r) => ({ ...r, exercises: (r.exercises || []).map((e) => ({ rest: 90, ...e })) })),
    session: null,
  });
  markAll();
  saveNow();
}

/* ---------------- supabase ---------------- */
const KEYCOL = { weight: "date", day: "date", routine: "id", gym: "id", cycle: "id" };
const now = () => new Date().toISOString();
const T = {
  profile: { table: "mfc_profile", conflict: "user_id", build: (u) => ({ user_id: u, data: state.profile || {}, updated_at: now() }) },
  weight: { table: "mfc_weight_logs", conflict: "user_id,date", build: (u, k) => { const w = state.weightLogs.find((x) => x.date === k); return w && { user_id: u, date: k, kg: w.kg, updated_at: now() }; } },
  day: { table: "mfc_days", conflict: "user_id,date", build: (u, k) => state.days[k] && { user_id: u, date: k, data: state.days[k], updated_at: now() } },
  routine: { table: "mfc_routines", conflict: "user_id,id", build: (u, k) => { const r = state.routines.find((x) => x.id === k); return r && { user_id: u, id: k, data: r, updated_at: now() }; } },
  gym: { table: "mfc_gym_logs", conflict: "user_id,id", build: (u, k) => { const g = state.gym.find((x) => x.id === k); return g && { user_id: u, id: k, date: g.date, exercise: g.exercise, data: { sets: g.sets, notes: g.notes || "", folderTag: g.folderTag || "" }, updated_at: now() }; } },
  cycle: { table: "mfc_cycles", conflict: "user_id,id", build: (u, k) => { const c = state.cycles.find((x) => x.id === k); return c && { user_id: u, id: k, start_date: c.start, updated_at: now() }; } },
  session: { table: "mfc_session", conflict: "user_id", build: (u) => ({ user_id: u, data: state.session, updated_at: now() }) },
};

let flushTimer, flushing = false;
export function scheduleFlush(ms = 700) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

export async function flush() {
  if (!client || !status.user || flushing) return;
  const entries = Object.values(outbox);
  if (!entries.length) { status.mode = "synced"; emit(); return; }
  if (!navigator.onLine) { status.mode = "offline"; emit(); return; }
  flushing = true; status.mode = "syncing"; emit();
  try {
    const u = status.user.id, groups = {}, dels = [];
    for (const e of entries) {
      const def = T[e.kind];
      const row = e.op === "delete" ? null : def.build(u, e.key);
      if (!row) { if (KEYCOL[e.kind]) dels.push(e); continue; }
      (groups[def.table] ||= { def, rows: [] }).rows.push(row);
    }
    for (const g of Object.values(groups)) {
      const { error } = await client.from(g.def.table).upsert(g.rows, { onConflict: g.def.conflict });
      if (error) throw error;
    }
    for (const e of dels) {
      const { error } = await client.from(T[e.kind].table).delete().eq("user_id", u).eq(KEYCOL[e.kind], e.key);
      if (error) throw error;
    }
    for (const e of entries) if (outbox[`${e.kind}:${e.key}`] === e) delete outbox[`${e.kind}:${e.key}`];
    status.error = "";
    status.mode = Object.keys(outbox).length ? "syncing" : "synced";
    saveNow();
  } catch (err) {
    console.warn("sync failed", err);
    status.mode = "offline"; status.error = err.message || String(err);
    scheduleFlush(8000);
  } finally {
    flushing = false; emit();
    if (Object.keys(outbox).length && status.mode === "syncing") scheduleFlush(300);
  }
}

async function fetchAll(table) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await client.from(table).select("*").eq("user_id", status.user.id).range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}
const pending = (kind, key = "_") => outbox[`${kind}:${key}`];

function mergeList(localArr, remoteArr, kind, keyOf) {
  const out = new Map(remoteArr.map((r) => [keyOf(r), r]));
  for (const l of localArr) {
    const k = keyOf(l), p = pending(kind, k);
    if (!p) continue;
    if (p.op === "delete") out.delete(k); else out.set(k, l);
  }
  return [...out.values()];
}

export async function pull() {
  if (!client || !status.user) return;
  const [prof, wl, days, rts, gym, cyc, ses] = await Promise.all(
    ["mfc_profile", "mfc_weight_logs", "mfc_days", "mfc_routines", "mfc_gym_logs", "mfc_cycles", "mfc_session"].map(fetchAll)
  );
  const remoteProfile = prof[0]?.data && Object.keys(prof[0].data).length ? prof[0].data : null;
  if (!remoteProfile && state.profile && !pending("profile")) markAll(); // first login: upload what lives on this device

  if (!pending("profile") && remoteProfile) state.profile = remoteProfile;
  state.weightLogs = mergeList(state.weightLogs, wl.map((r) => ({ date: r.date, kg: Number(r.kg) })), "weight", (x) => x.date);
  const dayMap = new Map(days.map((r) => [r.date, r.data]));
  for (const [d, v] of Object.entries(state.days)) {
    const p = pending("day", d);
    if (p) { if (p.op === "delete") dayMap.delete(d); else dayMap.set(d, v); }
  }
  state.days = Object.fromEntries(dayMap);
  state.routines = mergeList(state.routines, rts.map((r) => r.data), "routine", (x) => x.id);
  state.gym = mergeList(state.gym, gym.map((r) => ({ id: r.id, date: r.date, exercise: r.exercise, ...r.data })), "gym", (x) => x.id);
  state.cycles = mergeList(state.cycles, cyc.map((r) => ({ id: r.id, start: r.start_date })), "cycle", (x) => x.id);
  if (!pending("session")) state.session = ses[0]?.data || null;
  saveNow();
}

let lastPull = 0;
async function afterAuth() {
  const { data: ok, error } = await client.rpc("mfc_claim_owner");
  if (error || !ok) {
    status.error = "Esta base ya tiene otra dueña. Solo esa cuenta puede guardar datos.";
    await client.auth.signOut();
    status.user = null; status.mode = "signed-out"; emit();
    return false;
  }
  status.mode = "syncing"; emit();
  try { await pull(); lastPull = Date.now(); } catch (e) { status.mode = "offline"; status.error = e.message; emit(); return true; }
  await flush();
  return true;
}

export async function initSync(onReady) {
  try {
    const mod = await import(SUPABASE_ESM);
    client = mod.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  } catch (e) {
    status.mode = meta.localOnly ? "local" : "offline"; status.error = "No se pudo cargar Supabase (¿sin conexión?)";
    status.ready = true; emit(); onReady?.(); return;
  }
  const { data } = await client.auth.getSession();
  if (data.session) {
    status.user = data.session.user;
    status.mode = navigator.onLine ? "syncing" : "offline"; emit();
    if (navigator.onLine) await afterAuth();
  } else {
    status.mode = meta.localOnly ? "local" : "signed-out";
  }
  status.ready = true; emit(); onReady?.();
  client.auth.onAuthStateChange((evt, session) => {
    if (evt === "SIGNED_OUT") { status.user = null; status.mode = meta.localOnly ? "local" : "signed-out"; emit(); }
  });
  window.addEventListener("online", () => { flush(); });
  window.addEventListener("offline", () => { status.mode = "offline"; emit(); });
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden && status.user && !Object.keys(outbox).length && Date.now() - lastPull > 30000) {
      try { await pull(); lastPull = Date.now(); emit(); window.dispatchEvent(new Event("mfc:pulled")); } catch { /* offline */ }
    }
  });
}

export async function signIn(email, password) {
  if (!client) throw new Error("Sin conexión con Supabase");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  status.user = data.user; meta.localOnly = false; saveNow();
  return afterAuth();
}
export async function signUp(email, password) {
  if (!client) throw new Error("Sin conexión con Supabase");
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  if (!data.session) return "confirm";
  status.user = data.user; meta.localOnly = false; saveNow();
  return (await afterAuth()) ? "ok" : "denied";
}
export async function signOut() {
  if (client) await client.auth.signOut();
  status.user = null; status.mode = "signed-out"; emit();
}
export function useLocalOnly() { meta.localOnly = true; status.mode = "local"; saveNow(); emit(); }
