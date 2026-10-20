// Pure calculation helpers: energy budget, daily totals and target projection.
// No DOM access here so this module can be unit-tested with Node.

export const KCAL_PER_KG = 7700;

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };

// Mifflin-St Jeor basal metabolic rate.
export function bmr({ sex, age, heightCm, weightKg }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

export function tdee(profile, weightKg = profile.weightKg) {
  return bmr({ ...profile, weightKg }) * (ACTIVITY[profile.activity] ?? 1.2);
}

// Daily calorie allowance for the chosen weekly rate (kg/week, negative = lose).
export function dailyBudget(profile, weightKg = profile.weightKg) {
  const delta = (profile.weeklyRateKg * KCAL_PER_KG) / 7;
  const floor = profile.sex === 'female' ? 1200 : 1500;
  return Math.round(Math.max(floor, tdee(profile, weightKg) + delta));
}

export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function mealTotal(meal) {
  return meal.items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
}

export function intakeByDay(meals) {
  const out = {};
  for (const m of meals) out[m.day] = (out[m.day] || 0) + mealTotal(m);
  return out;
}

// Latest weigh-in on or before `day`, else the profile starting weight.
export function weightOn(state, day) {
  let best = null;
  for (const w of state.weights) if (w.day <= day && (!best || w.day >= best.day)) best = w;
  return best ? best.kg : state.profile.weightKg;
}

/**
 * Builds the trend: an estimated weight per day from the first weigh-in/start
 * until today (anchored to real weigh-ins, otherwise driven by the calorie
 * balance), then projects forward at the recent average balance to estimate
 * when the target weight is reached.
 */
export function buildTrend(state, today = dayKey()) {
  const { profile } = state;
  const intake = intakeByDay(state.meals);
  const start = profile.startDay;
  const history = [];
  let est = profile.weightKg;
  const weighIns = Object.fromEntries(state.weights.map((w) => [w.day, w.kg]));

  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (weighIns[d] != null) {
      // Blend toward the scale reading so daily water swings don't dominate.
      est = d === start ? weighIns[d] : est * 0.5 + weighIns[d] * 0.5;
    }
    history.push({ day: d, kg: est, weighIn: weighIns[d] ?? null, intake: intake[d] ?? null });
    if (intake[d] != null) est -= (tdee(profile, est) - intake[d]) / KCAL_PER_KG;
  }

  // Recent balance: average over the last 14 logged days (excluding today, which is partial).
  const recent = history.filter((h) => h.intake != null && h.day < today).slice(-14);
  const plannedDaily = (profile.weeklyRateKg * KCAL_PER_KG) / 7;
  const avgBalance = recent.length
    ? recent.reduce((s, h) => s + (h.intake - tdee(profile, h.kg)), 0) / recent.length
    : plannedDaily;

  const current = history[history.length - 1].kg;
  const goal = profile.targetKg;
  const needLoss = goal < current;
  const kgPerDay = avgBalance / KCAL_PER_KG;
  const movingRightWay = needLoss ? kgPerDay < 0 : kgPerDay > 0;
  const reached = Math.abs(current - goal) < 0.25;

  let etaDays = null;
  if (reached) etaDays = 0;
  else if (movingRightWay) etaDays = Math.ceil(Math.abs(goal - current) / Math.abs(kgPerDay));

  const plannedDays = profile.weeklyRateKg
    ? Math.ceil(Math.abs(goal - current) / Math.abs(plannedDaily / KCAL_PER_KG))
    : null;

  const projection = [];
  if (etaDays != null && etaDays <= 730) {
    for (let i = 1; i <= etaDays; i += Math.max(1, Math.floor(etaDays / 60))) {
      projection.push({ day: addDays(today, i), kg: current + kgPerDay * i });
    }
    projection.push({ day: addDays(today, etaDays), kg: goal });
  }

  return {
    history,
    projection,
    current,
    avgBalance: Math.round(avgBalance),
    loggedDays: recent.length,
    etaDays,
    etaDay: etaDays != null ? addDays(today, etaDays) : null,
    plannedDay: plannedDays != null ? addDays(today, plannedDays) : null,
    reached,
  };
}
