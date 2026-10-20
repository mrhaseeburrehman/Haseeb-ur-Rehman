// Meal recognition with Claude: a photo and/or a description becomes a list of
// food items with calorie estimates.
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';

const MODEL = 'claude-opus-5-5';

const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short name for the meal, e.g. "Chicken salad lunch"' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Food and estimated portion, e.g. "Grilled chicken breast (150 g)"' },
          calories: { type: 'integer' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string', description: 'One sentence on assumptions made, or empty' },
  },
  required: ['title', 'items', 'notes'],
  additionalProperties: false,
};

const SYSTEM = `You estimate the nutritional content of meals for a calorie-tracking app.
Identify every distinct food and drink from the photo and/or description, estimate a realistic
portion size for each, and give calories and macros per item. Use typical UK/US portion sizes
when the size is unclear, and mention significant assumptions in "notes". If the description
gives quantities, trust them over the photo.`;

export async function analyzeMeal({ apiKey, imageDataUrl, text }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const content = [];
  if (imageDataUrl) {
    const [, mediaType, data] = imageDataUrl.match(/^data:(.+?);base64,(.*)$/);
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
  }
  content.push({ type: 'text', text: text?.trim() ? `What I had: ${text}` : 'Estimate this meal.' });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: MEAL_SCHEMA } },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The request was declined. Try a different photo or description.');
  if (response.stop_reason === 'max_tokens') throw new Error('The response was cut off. Please try again.');
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No result returned.');
  return JSON.parse(textBlock.text);
}

export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it in Settings.';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited. Wait a moment and try again.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the server. Check your connection.';
  if (err instanceof Anthropic.APIError) return `API error: ${err.message}`;
  return err.message || String(err);
}
