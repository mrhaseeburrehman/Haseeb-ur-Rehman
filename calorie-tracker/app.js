import { dailyBudget, dayKey, addDays, mealTotal, intakeByDay, weightOn, buildTrend } from './calc.js';
import { parseMealText } from './foods.js';

const STORE = 'calorie-trend-v1';
const KEY_STORE = 'calorie-trend-api-key';
const $ = (id) => document.getElementById(id);

// ---------- state ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s?.profile) return s;
  } catch {}
  return { profile: null, meals: [], weights: [] };
}
let state = load();
const save = () => localStorage.setItem(STORE, JSON.stringify(state));
const apiKey = () => localStorage.getItem(KEY_STORE) || '';

const today = () => dayKey();
const budgetFor = (day) => dailyBudget(state.profile, weightOn(state, day));
const fmtDate = (key, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- navigation ----------
function show(view) {
  if (!state.profile && view !== 'settings') view = 'settings';
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== `view-${view}`));
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  render[view]?.();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

// ---------- today ----------
function etaText(trend) {
  if (trend.reached) return 'Reached';
  return trend.etaDay ? fmtDate(trend.etaDay, { day: 'numeric', month: 'short' }) : 'Off track';
}

function trendSentence(trend) {
  const { profile } = state;
  if (trend.reached) return `🎉 You're at your target of ${profile.targetKg} kg. Keep it steady!`;
  if (!trend.loggedDays) {
    return `Log meals for a few days and your projected target date will update automatically. Following the plan gets you to ${profile.targetKg} kg around ${fmtDate(trend.plannedDay)}.`;
  }
  if (!trend.etaDay) {
    return `⚠️ Over the last ${trend.loggedDays} logged day(s) you've averaged ${Math.abs(trend.avgBalance)} kcal/day ${trend.avgBalance > 0 ? 'above' : 'below'} your burn, which moves you away from ${profile.targetKg} kg. Sticking to your daily budget puts you back on track.`;
  }
  const diff = trend.plannedDay ? Math.round((new Date(trend.etaDay) - new Date(trend.plannedDay)) / 86400000) : 0;
  const vs = Math.abs(diff) < 3 ? 'right on plan ✅' : diff < 0 ? `${-diff} days ahead of plan 🚀` : `${diff} days behind plan`;
  return `At your recent pace you'll hit ${profile.targetKg} kg on ${fmtDate(trend.etaDay)} — ${vs}.`;
}

const render = {};
render.today = () => {
  const t = today();
  const budget = budgetFor(t);
  const meals = state.meals.filter((m) => m.day === t);
  const eaten = meals.reduce((s, m) => s + mealTotal(m), 0);
  const left = budget - eaten;
  const trend = buildTrend(state, t);

  $('today-date').textContent = fmtDate(t, { weekday: 'long', day: 'numeric', month: 'short' });
  $('remaining').textContent = Math.abs(left);
  $('remaining-label').textContent = left >= 0 ? 'kcal left' : 'kcal over';
  $('stat-budget').textContent = budget;
  $('stat-eaten').textContent = eaten;
  $('stat-eta').textContent = etaText(trend);
  $('trend-note').textContent = trendSentence(trend);

  const ring = $('ring-fg');
  const C = 2 * Math.PI * 52;
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - Math.min(1, eaten / budget));
  ring.classList.toggle('over', left < 0);

  $('no-meals').hidden = meals.length > 0;
  $('meal-list').innerHTML = meals.map((m) => `
    <li>
      ${m.photo ? `<img src="${m.photo}" alt="">` : '<span class="thumb">🍽️</span>'}
      <div class="grow"><strong>${esc(m.title)}</strong><small>${new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${m.items.map((i) => esc(i.name)).join(', ')}</small></div>
      <span class="kcal">${mealTotal(m)}</span>
      <button class="icon-btn del" data-id="${m.id}" aria-label="Delete">✕</button>
    </li>`).join('');
  $('meal-list').querySelectorAll('.del').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Delete this meal?')) return;
    state.meals = state.meals.filter((m) => m.id !== b.dataset.id);
    save();
    render.today();
  }));
};

// ---------- log a meal ----------
let draft = { photo: null, items: [] };

function resetDraft() {
  draft = { photo: null, items: [] };
  $('photo-preview').hidden = true;
  $('photo-hint').hidden = false;
  $('meal-text').value = '';
  $('analyze-status').textContent = '';
  $('review').hidden = true;
}

render.log = () => {
  if (!draft.items.length && !draft.photo) resetDraft();
};

// Downscale photos so they're cheap to send and store.
function resizeImage(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function thumbnail(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

$('photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  draft.photo = await resizeImage(file);
  $('photo-preview').src = draft.photo;
  $('photo-preview').hidden = false;
  $('photo-hint').hidden = true;
});

// Voice input via the Web Speech API (Chrome/Edge/Safari).
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!Recognition) $('mic-btn').hidden = true;
let listening = null;
$('mic-btn').addEventListener('click', () => {
  if (listening) return listening.stop();
  const rec = new Recognition();
  rec.lang = navigator.language || 'en-GB';
  rec.interimResults = true;
  const before = $('meal-text').value.trim();
  rec.onresult = (e) => {
    const said = [...e.results].map((r) => r[0].transcript).join(' ');
    $('meal-text').value = [before, said].filter(Boolean).join(', ');
  };
  rec.onend = () => { listening = null; $('mic-btn').classList.remove('live'); };
  rec.onerror = (e) => { $('analyze-status').textContent = `Mic error: ${e.error}`; };
  rec.start();
  listening = rec;
  $('mic-btn').classList.add('live');
});

$('analyze-btn').addEventListener('click', async () => {
  const text = $('meal-text').value.trim();
  const status = $('analyze-status');
  if (!draft.photo && !text) { status.textContent = 'Add a photo or describe your meal first.'; return; }

  let result;
  if (apiKey()) {
    status.textContent = 'Analysing your meal…';
    $('analyze-btn').disabled = true;
    try {
      const { analyzeMeal } = await import('./ai.js');
      result = await analyzeMeal({ apiKey: apiKey(), imageDataUrl: draft.photo, text });
    } catch (err) {
      const { describeError } = await import('./ai.js').catch(() => ({ describeError: (e) => e.message }));
      status.textContent = describeError(err);
      return;
    } finally {
      $('analyze-btn').disabled = false;
    }
  } else {
    const items = parseMealText(text);
    if (!items.length) {
      status.textContent = draft.photo
        ? 'Photo recognition needs an API key (Plan tab). Describe the meal instead, or add items manually below.'
        : "Couldn't recognise those foods. Add items manually below.";
    }
    result = { title: text ? text.slice(0, 40) : 'Meal', items, notes: items.length ? 'Estimated from the built-in food list.' : '' };
  }
  status.textContent = '';
  draft.items = result.items.map((i) => ({ name: i.name, calories: i.calories }));
  $('meal-title').value = result.title;
  $('meal-notes').textContent = result.notes || '';
  renderItems();
  $('review').hidden = false;
  $('review').scrollIntoView({ behavior: 'smooth' });
});

function renderItems() {
  $('item-list').innerHTML = draft.items.map((i, n) => `
    <li>
      <input class="grow" data-n="${n}" data-f="name" value="${esc(i.name)}">
      <input class="num" data-n="${n}" data-f="calories" type="number" inputmode="numeric" value="${i.calories}">
      <button class="icon-btn" data-rm="${n}" aria-label="Remove">✕</button>
    </li>`).join('');
  $('item-list').querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
    const it = draft.items[inp.dataset.n];
    it[inp.dataset.f] = inp.dataset.f === 'calories' ? Number(inp.value) || 0 : inp.value;
    updateTotal();
  }));
  $('item-list').querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    draft.items.splice(b.dataset.rm, 1);
    renderItems();
  }));
  updateTotal();
}

function updateTotal() {
  const total = mealTotal(draft);
  const t = today();
  const eaten = state.meals.filter((m) => m.day === t).reduce((s, m) => s + mealTotal(m), 0);
  const left = budgetFor(t) - eaten - total;
  $('meal-total').textContent = `${total} kcal`;
  $('meal-impact').textContent = left >= 0
    ? `After this you'll have ${left} kcal left today.`
    : `This puts you ${-left} kcal over today's budget.`;
}

$('add-item').addEventListener('click', () => {
  draft.items.push({ name: '', calories: 0 });
  renderItems();
  $('item-list').querySelector('li:last-child input').focus();
});

$('save-meal').addEventListener('click', async () => {
  const items = draft.items.filter((i) => i.name.trim() || i.calories);
  if (!items.length) { $('meal-impact').textContent = 'Add at least one item.'; return; }
  state.meals.push({
    id: crypto.randomUUID(),
    day: today(),
    time: Date.now(),
    title: $('meal-title').value.trim() || 'Meal',
    items,
    photo: draft.photo ? await thumbnail(draft.photo) : null,
  });
  save();
  resetDraft();
  show('today');
});

// ---------- trend ----------
render.trend = () => {
  const t = today();
  const trend = buildTrend(state, t);
  $('tr-current').textContent = trend.current.toFixed(1);
  $('tr-balance').textContent = trend.loggedDays ? (trend.avgBalance > 0 ? '+' : '') + trend.avgBalance : '–';
  $('tr-eta').textContent = etaText(trend);
  $('tr-detail').textContent = trendSentence(trend);
  drawChart(trend);

  const intake = intakeByDay(state.meals);
  const days = [...Array(7)].map((_, i) => addDays(t, -i));
  $('day-list').innerHTML = days.map((d) => {
    const b = budgetFor(d);
    const e = intake[d];
    const cls = e == null ? '' : e <= b ? 'good' : 'bad';
    return `<li><div class="grow"><strong>${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
      <small>${e == null ? 'Not logged' : `${e} / ${b} kcal`}</small></div>
      <span class="kcal ${cls}">${e == null ? '' : (e - b > 0 ? '+' : '') + (e - b)}</span></li>`;
  }).join('');
};

function drawChart(trend) {
  const svg = $('chart');
  const W = 340, H = 200, P = { l: 34, r: 8, t: 10, b: 22 };
  const pts = [...trend.history, ...trend.projection];
  const goal = state.profile.targetKg;
  const kgs = pts.map((p) => p.kg).concat(goal, ...trend.history.filter((h) => h.weighIn).map((h) => h.weighIn));
  let min = Math.min(...kgs), max = Math.max(...kgs);
  if (max - min < 2) { min -= 1; max += 1; }
  const first = pts[0].day, last = pts[pts.length - 1].day;
  const span = Math.max(1, (new Date(last) - new Date(first)) / 86400000);
  const x = (day) => P.l + ((new Date(day) - new Date(first)) / 86400000 / span) * (W - P.l - P.r);
  const y = (kg) => P.t + (1 - (kg - min) / (max - min)) * (H - P.t - P.b);
  const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.kg).toFixed(1)}`).join('');

  const ticks = [min, (min + max) / 2, max];
  const lastHist = trend.history[trend.history.length - 1];
  svg.innerHTML = `
    ${ticks.map((k) => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y(k)}" y2="${y(k)}"/><text class="axis" x="${P.l - 4}" y="${y(k) + 3}" text-anchor="end">${k.toFixed(0)}</text>`).join('')}
    <line class="goal" x1="${P.l}" x2="${W - P.r}" y1="${y(goal)}" y2="${y(goal)}"/>
    <path class="hist" d="${path(trend.history)}"/>
    ${trend.projection.length ? `<path class="proj" d="${path([lastHist, ...trend.projection])}"/>` : ''}
    ${trend.history.filter((h) => h.weighIn).map((h) => `<circle class="dot" cx="${x(h.day)}" cy="${y(h.weighIn)}" r="3"/>`).join('')}
    <text class="axis" x="${P.l}" y="${H - 6}">${fmtDate(first, { day: 'numeric', month: 'short' })}</text>
    <text class="axis" x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmtDate(last, { day: 'numeric', month: 'short' })}</text>`;
}

$('weight-save').addEventListener('click', () => {
  const kg = Number($('weight-input').value);
  if (!(kg > 20 && kg < 400)) return;
  const t = today();
  state.weights = state.weights.filter((w) => w.day !== t).concat({ day: t, kg });
  save();
  $('weight-input').value = '';
  render.trend();
});

// ---------- settings ----------
const form = $('profile-form');
function formProfile() {
  const f = Object.fromEntries(new FormData(form));
  const weightKg = Number(f.weightKg), targetKg = Number(f.targetKg);
  const pace = Number(f.pace);
  return {
    sex: f.sex, age: Number(f.age), heightCm: Number(f.heightCm), weightKg, targetKg,
    activity: f.activity, pace,
    weeklyRateKg: targetKg < weightKg ? -pace : targetKg > weightKg ? pace / 2 : 0,
  };
}
function previewBudget() {
  const p = formProfile();
  $('budget-preview').textContent = p.age && p.heightCm && p.weightKg
    ? `Your daily budget: ${dailyBudget(p)} kcal`
    : '';
}
form.addEventListener('input', previewBudget);

render.settings = () => {
  const p = state.profile;
  if (p) {
    for (const [k, v] of Object.entries({ ...p, pace: String(p.pace) })) if (form.elements[k]) form.elements[k].value = v;
  }
  $('api-key').value = apiKey();
  previewBudget();
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const p = formProfile();
  const old = state.profile;
  // A new starting weight restarts the trend from today; other edits keep history.
  const restart = !old || old.weightKg !== p.weightKg;
  state.profile = { ...p, startDay: restart ? today() : old.startDay };
  if (restart) state.weights = state.weights.filter((w) => w.day !== today()).concat({ day: today(), kg: p.weightKg });
  save();
  show('today');
});

$('save-key').addEventListener('click', () => {
  localStorage.setItem(KEY_STORE, $('api-key').value.trim());
  $('save-key').textContent = 'Saved ✓';
  setTimeout(() => ($('save-key').textContent = 'Save key'), 1500);
});

$('reset').addEventListener('click', () => {
  if (!confirm('Delete all meals, weights and your plan?')) return;
  localStorage.removeItem(STORE);
  state = load();
  show('settings');
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
show(state.profile ? 'today' : 'settings');
