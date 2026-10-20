# Calorie Trend

A mobile web app (installable PWA) to log meals by **photo, voice or text**. Each meal is
subtracted from your daily calorie budget, and every meal updates a **trend that projects the
date you'll reach your target weight**.

## How it works

1. **Plan tab** – enter sex, age, height, current weight, target weight, activity and pace.
   Your daily budget is your estimated burn (Mifflin-St Jeor × activity) minus the deficit for
   your pace (7700 kcal ≈ 1 kg), with a safe floor.
2. **＋ button** – take a photo of the meal and/or tap 🎤 and say what you had. With an
   Anthropic API key, Claude identifies each food, estimates portions and calories, and you can
   edit the items before saving. Without a key, typed/spoken meals are matched against a
   built-in food list.
3. **Today tab** – a ring shows how much of today's budget is left, plus your current
   projected target date.
4. **Trend tab** – estimated weight per day (from your calorie balance, pulled toward any
   weigh-ins you log), and a projection at your average balance over the last 14 logged days.
   It tells you whether you're ahead of, on, or behind plan and when you'll hit the target.

All data stays on the device (localStorage). The API key is also stored only on the device and
sent directly to the Anthropic API.

## Run it

```bash
cd calorie-tracker
npm start        # serves on http://localhost:8080
npm test         # unit tests for the budget/trend maths and text parser
```

To use it on a phone, host the folder on any HTTPS static host (GitHub Pages, Netlify, …),
open it on the phone and choose **Add to Home Screen**. Camera and microphone access need HTTPS.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Mobile UI: Today, Log, Trend and Plan screens |
| `app.js` | UI logic, storage, photo/voice capture, chart |
| `calc.js` | Budget, daily totals and target-date projection (pure, tested) |
| `ai.js` | Meal recognition with Claude (photo + description → items and calories) |
| `foods.js` | Offline food list and phrase parser |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Installable, works offline |

> Calorie estimates from photos are approximate. This is not medical advice.
