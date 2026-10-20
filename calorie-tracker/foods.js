// Offline fallback: a small food table and a parser for phrases like
// "2 eggs, a slice of toast and a coffee with milk". Used when no API key is set.

const FOODS = [
  ['egg', 78, 'egg'], ['toast', 80, 'slice'], ['bread', 80, 'slice'], ['butter', 35, 'tsp'],
  ['banana', 105, 'banana'], ['apple', 95, 'apple'], ['orange', 62, 'orange'], ['grapes', 100, 'cup'],
  ['porridge', 160, 'bowl'], ['oats', 150, 'bowl'], ['cereal', 180, 'bowl'], ['granola', 250, 'bowl'],
  ['yogurt', 120, 'pot'], ['yoghurt', 120, 'pot'], ['milk', 60, 'splash'], ['latte', 150, 'cup'],
  ['cappuccino', 110, 'cup'], ['coffee', 5, 'cup'], ['tea', 5, 'cup'], ['orange juice', 110, 'glass'],
  ['coke', 140, 'can'], ['beer', 200, 'pint'], ['wine', 125, 'glass'], ['water', 0, 'glass'],
  ['sandwich', 350, 'sandwich'], ['wrap', 400, 'wrap'], ['burger', 550, 'burger'], ['fries', 350, 'portion'],
  ['chips', 350, 'portion'], ['crisps', 130, 'bag'], ['pizza', 285, 'slice'], ['pasta', 400, 'plate'],
  ['rice', 240, 'cup'], ['chicken', 280, 'breast'], ['salmon', 350, 'fillet'], ['steak', 500, 'steak'],
  ['curry', 600, 'portion'], ['salad', 150, 'bowl'], ['soup', 200, 'bowl'], ['avocado', 240, 'avocado'],
  ['cheese', 110, 'slice'], ['chocolate', 230, 'bar'], ['biscuit', 70, 'biscuit'], ['cookie', 150, 'cookie'],
  ['cake', 350, 'slice'], ['croissant', 230, 'croissant'], ['muffin', 400, 'muffin'], ['donut', 260, 'donut'],
  ['ice cream', 270, 'scoop'], ['protein shake', 180, 'shake'], ['nuts', 170, 'handful'], ['potato', 160, 'potato'],
  ['bacon', 45, 'rasher'], ['sausage', 180, 'sausage'], ['beans', 160, 'half tin'], ['noodles', 380, 'portion'],
  ['sushi', 45, 'piece'], ['kebab', 700, 'kebab'], ['fish and chips', 900, 'portion'], ['burrito', 700, 'burrito'],
];

const WORD_NUMS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, couple: 2, few: 3 };

export function parseMealText(text) {
  const items = [];
  const parts = text.toLowerCase().split(/,|\band\b|\bwith\b|\bplus\b|\+|\n/);
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    // Longest name first so "orange juice" beats "orange".
    const match = [...FOODS].sort((a, b) => b[0].length - a[0].length)
      .find(([name]) => new RegExp(`\\b${name}(e?s)?\\b`).test(part));
    if (!match) continue;
    const numMatch = part.match(/(\d+(?:\.\d+)?)/);
    const wordMatch = part.match(/\b(a|an|one|two|three|four|five|six|half|couple|few)\b/);
    const qty = numMatch ? Number(numMatch[1]) : wordMatch ? WORD_NUMS[wordMatch[1]] : 1;
    const [name, kcal, unit] = match;
    items.push({ name: `${name} (${qty} ${unit})`, calories: Math.round(kcal * qty) });
  }
  return items;
}
