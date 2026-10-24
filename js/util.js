export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const pad = (n) => String(n).padStart(2, "0");
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return todayISO(d); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = (iso, o = { weekday: "long", day: "numeric", month: "long" }) => new Date(iso + "T00:00:00").toLocaleDateString("es-MX", o);
export const fmtNum = (n) => Math.round(n).toLocaleString("es-MX");
export const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const fmtDur = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
};
export const kgStr = (n) => (Math.round(n * 100) / 100).toString().replace(/\.0+$/, "");
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const weekdayName = (iso = todayISO()) => WEEKDAYS[new Date(iso + "T00:00:00").getDay()];
export const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let toastTimer;
export function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 2200);
}

export function haptic(p = 12) {
  try { navigator.vibrate && navigator.vibrate(p); } catch { /* unsupported */ }
}

export function confetti(n = 22) {
  if (reducedMotion()) return;
  const colors = ["#FF4FA3", "#B388FF", "#FF5B6B", "#F1E8F6"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.background = colors[i % colors.length];
    p.style.left = 40 + Math.random() * 20 + "%";
    p.style.setProperty("--dx", Math.random() * 320 - 160 + "px");
    p.style.setProperty("--rot", Math.random() * 600 - 300 + "deg");
    p.style.animationDelay = Math.random() * 120 + "ms";
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}

let audioCtx;
export function beep(freq = 880, ms = 140) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio blocked */ }
}

// global event delegation: modules register handlers by data-act / data-in
export const actions = {};
export const inputs = {};
export function bindDelegation() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e);
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-in]");
    if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, e);
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-live]");
    if (el && inputs[el.dataset.live]) inputs[el.dataset.live](el, e);
  });
}
