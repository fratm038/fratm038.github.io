"use strict";

/* ============ 1. CITY DATA — add new cities here ============ */
const CITIES = [
  { name: "Rome", country: "Italy", timeZone: "Europe/Rome" },
  { name: "London", country: "United Kingdom", timeZone: "Europe/London" },
  { name: "Paris", country: "France", timeZone: "Europe/Paris" },
  { name: "Berlin", country: "Germany", timeZone: "Europe/Berlin" },
  { name: "Madrid", country: "Spain", timeZone: "Europe/Madrid" },
  { name: "Lisbon", country: "Portugal", timeZone: "Europe/Lisbon" },
  { name: "Athens", country: "Greece", timeZone: "Europe/Athens" },
  { name: "Moscow", country: "Russia", timeZone: "Europe/Moscow" },
  { name: "New York", country: "United States", timeZone: "America/New_York" },
  { name: "Los Angeles", country: "United States", timeZone: "America/Los_Angeles" },
  { name: "Chicago", country: "United States", timeZone: "America/Chicago" },
  { name: "Toronto", country: "Canada", timeZone: "America/Toronto" },
  { name: "Mexico City", country: "Mexico", timeZone: "America/Mexico_City" },
  { name: "São Paulo", country: "Brazil", timeZone: "America/Sao_Paulo" },
  { name: "Buenos Aires", country: "Argentina", timeZone: "America/Argentina/Buenos_Aires" },
  { name: "Tokyo", country: "Japan", timeZone: "Asia/Tokyo" },
  { name: "Seoul", country: "South Korea", timeZone: "Asia/Seoul" },
  { name: "Beijing", country: "China", timeZone: "Asia/Shanghai" },
  { name: "Singapore", country: "Singapore", timeZone: "Asia/Singapore" },
  { name: "Bangkok", country: "Thailand", timeZone: "Asia/Bangkok" },
  { name: "Dubai", country: "United Arab Emirates", timeZone: "Asia/Dubai" },
  { name: "Mumbai", country: "India", timeZone: "Asia/Kolkata" },
  { name: "Sydney", country: "Australia", timeZone: "Australia/Sydney" },
  { name: "Melbourne", country: "Australia", timeZone: "Australia/Melbourne" },
  { name: "Auckland", country: "New Zealand", timeZone: "Pacific/Auckland" },
  { name: "Cairo", country: "Egypt", timeZone: "Africa/Cairo" },
  { name: "Johannesburg", country: "South Africa", timeZone: "Africa/Johannesburg" },
  { name: "Nairobi", country: "Kenya", timeZone: "Africa/Nairobi" }
];

/* ============ 2. STATE & HELPERS ============ */
const KEYS = { favs: "wc_favorites", fmt: "wc_hour12", theme: "wc_theme" };
const state = { favs: [], hour12: false, query: "", localTz: "UTC" };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// localStorage wrapper: never throws (private mode, blocked storage...)
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }
};

const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function showError(msg) {
  const box = $("#errorBox");
  box.textContent = msg;
  box.hidden = false;
}

/* ============ 3. TIME (all based on Intl, no manual time zone math) ============ */
const formatters = new Map();
function dtf(tz, opts, locale = "en-US") {
  const key = locale + tz + JSON.stringify(opts);
  let f = formatters.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts }); formatters.set(key, f); }
  return f;
}

const fmtTime = (tz, d, seconds = true) => dtf(tz, {
  hour: state.hour12 ? "numeric" : "2-digit",
  minute: "2-digit",
  ...(seconds ? { second: "2-digit" } : {}),
  ...(state.hour12 ? { hour12: true } : { hourCycle: "h23" })
}).format(d);

const fmtDate = (tz, d, long = false) =>
  dtf(tz, { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", year: "numeric" }, "en-GB").format(d);

const hourOf = (tz, d) => Number(dtf(tz, { hour: "numeric", hourCycle: "h23" }).format(d)) % 24;

// UTC offset (minutes) of a time zone at a given instant, derived from Intl
function offsetMin(tz, d) {
  const parts = {};
  dtf(tz, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
    .formatToParts(d).forEach(p => { parts[p.type] = p.value; });
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

function diffLabel(tz, d) {
  const m = offsetMin(tz, d) - offsetMin(state.localTz, d);
  if (m === 0) return "Same time as you";
  const a = Math.abs(m), h = Math.floor(a / 60), min = a % 60;
  const text = [h && h + "h", min && min + "m"].filter(Boolean).join(" ");
  return `${text} ${m > 0 ? "ahead of" : "behind"} you`;
}

function utcLabel(tz, d) {
  const m = offsetMin(tz, d), a = Math.abs(m);
  return `UTC${m < 0 ? "−" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

const cityLabel = tz => tz.split("/").pop().replace(/_/g, " ");

/* ============ 4. CITY CARDS ============ */
function makeCard(city) {
  const isFav = state.favs.includes(city.name);
  const el = document.createElement("article");
  el.className = "city";
  el.dataset.tz = city.timeZone;
  el.innerHTML = `
    <div class="city-top">
      <div><h3>${city.name}</h3><p class="muted">${city.country}</p></div>
      <span class="badge" data-f="dn"></span>
    </div>
    <p class="time" data-f="time"></p>
    <p data-f="date"></p>
    <p class="muted" data-f="diff"></p>
    <button class="btn" type="button" data-fav="${city.name}"
      aria-label="${isFav ? "Remove " + city.name + " from favorites" : "Add " + city.name + " to favorites"}">
      ${isFav ? "Remove from favorites" : "Add to favorites"}</button>`;
  return el;
}

function fill(container, cities) {
  container.replaceChildren(...cities.map(makeCard));
}

function renderLists() {
  const q = norm(state.query.trim());
  const found = CITIES.filter(c => norm(c.name + " " + c.country).includes(q));
  fill($("#cityGrid"), found);
  $("#noResults").hidden = found.length > 0;
  $("#resultCount").textContent = q ? `${found.length} ${found.length === 1 ? "city" : "cities"} found` : "";

  const favCities = CITIES.filter(c => state.favs.includes(c.name));
  fill($("#favGrid"), favCities);
  $("#noFavs").hidden = favCities.length > 0;
  tick();
}

function toggleFavorite(name) {
  state.favs = state.favs.includes(name) ? state.favs.filter(n => n !== name) : [...state.favs, name];
  store.set(KEYS.favs, state.favs);
  renderLists();
}

/* ============ 5. LIVE UPDATE (every second, without rebuilding the cards) ============ */
function tick() {
  const now = new Date();
  try {
    $$(".city").forEach(el => {
      const tz = el.dataset.tz;
      const isDay = hourOf(tz, now) >= 6 && hourOf(tz, now) < 18;
      const badge = $('[data-f="dn"]', el);
      badge.textContent = isDay ? "☀️ Day" : "🌙 Night";
      badge.className = "badge " + (isDay ? "day" : "night");
      $('[data-f="time"]', el).textContent = fmtTime(tz, now);
      $('[data-f="date"]', el).textContent = fmtDate(tz, now);
      $('[data-f="diff"]', el).textContent = diffLabel(tz, now);
    });
    $("#localZone").textContent = `Your time zone: ${state.localTz.replace(/_/g, " ")} (${utcLabel(state.localTz, now)})`;
    $("#localTime").textContent = fmtTime(state.localTz, now);
    $("#localDate").textContent = fmtDate(state.localTz, now, true);
    $("#localMeta").textContent = state.hour12 ? "12-hour format (AM/PM)" : "24-hour format";
  } catch (err) {
    showError("Could not update the clocks in this browser.");
  }
}

function loop() { tick(); setTimeout(loop, 1000 - (Date.now() % 1000)); }

/* ============ 6. TIME ZONE CONVERTER ============ */
function fillSelects() {
  const opts = [`<option value="${state.localTz}">My local time (${cityLabel(state.localTz)})</option>`]
    .concat([...CITIES].sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${c.timeZone}">${c.name}, ${c.country}</option>`))
    .concat('<option value="UTC">UTC</option>');
  $("#convFrom").innerHTML = opts.join("");
  $("#convTo").innerHTML = opts.join("");
  $("#convFrom").value = state.localTz;
  $("#convTo").value = state.localTz === "America/New_York" ? "Europe/London" : "America/New_York";
}

function setConverterToNow() {
  const now = new Date();
  $("#convDate").value = dtf(state.localTz, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(now);
  $("#convTime").value = dtf(state.localTz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB").format(now);
}

function convert() {
  const out = $("#convResult");
  const [y, mo, d] = $("#convDate").value.split("-").map(Number);
  const [h, mi] = $("#convTime").value.split(":").map(Number);
  if (!y || Number.isNaN(h)) { out.textContent = "Choose a date and a time to convert."; return; }
  const from = $("#convFrom").value, to = $("#convTo").value;
  try {
    // Wall-clock time in the source zone -> real instant (two passes handle DST changes)
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let instant = guess - offsetMin(from, new Date(guess)) * 60000;
    instant = guess - offsetMin(from, new Date(instant)) * 60000;
    const result = new Date(instant);
    const name = sel => $(sel).selectedOptions[0].textContent.split(",")[0].replace(/^My local time \((.*)\)$/, "$1");
    out.textContent = `${fmtTime(from, result, false)} ${name("#convFrom")} → ${fmtTime(to, result, false)} ${name("#convTo")} (${fmtDate(to, result, true)})`;
  } catch (err) {
    out.textContent = "This conversion is not available in your browser.";
  }
}

/* ============ 7. PREFERENCES ============ */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $("#themeBtn");
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  store.set(KEYS.theme, theme);
}

function applyFormat(hour12) {
  state.hour12 = hour12;
  $("#fmt12").setAttribute("aria-pressed", String(hour12));
  $("#fmt24").setAttribute("aria-pressed", String(!hour12));
  store.set(KEYS.fmt, hour12);
  tick();
  convert();
}

/* ============ 8. INIT ============ */
function init() {
  try { state.localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { state.localTz = "UTC"; }

  const savedFavs = store.get(KEYS.favs, []);
  state.favs = Array.isArray(savedFavs) ? savedFavs.filter(n => CITIES.some(c => c.name === n)) : [];
  applyTheme(store.get(KEYS.theme, "dark") === "light" ? "light" : "dark");
  state.hour12 = store.get(KEYS.fmt, false) === true;

  fillSelects();
  setConverterToNow();
  renderLists();
  applyFormat(state.hour12);

  // Events
  $("#search").addEventListener("input", e => { state.query = e.target.value; renderLists(); });
  $("#search").addEventListener("keydown", e => { if (e.key === "Enter") $("#world").scrollIntoView(); });
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-fav]");
    if (btn) toggleFavorite(btn.dataset.fav);
  });
  $("#fmt12").addEventListener("click", () => applyFormat(true));
  $("#fmt24").addEventListener("click", () => applyFormat(false));
  $("#themeBtn").addEventListener("click", () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  ["#convFrom", "#convTo", "#convDate", "#convTime"].forEach(s => $(s).addEventListener("input", convert));
  $("#swap").addEventListener("click", () => {
    const a = $("#convFrom").value; $("#convFrom").value = $("#convTo").value; $("#convTo").value = a; convert();
  });
  $("#useLocal").addEventListener("click", () => {
    $("#convFrom").value = state.localTz; setConverterToNow(); convert();
    $("#converter").scrollIntoView();
  });
  const toTop = $("#toTop");
  toTop.addEventListener("click", () => window.scrollTo({ top: 0 }));
  window.addEventListener("scroll", () => { toTop.hidden = window.scrollY < 600; }, { passive: true });

  $("#year").textContent = new Date().getFullYear();
  convert();
  loop();
}

try { init(); }
catch (err) { showError("Something went wrong while loading WorldClock. Try reloading the page."); }
