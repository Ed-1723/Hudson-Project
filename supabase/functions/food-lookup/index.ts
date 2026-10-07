// Supabase Edge Function: looks up nutrition estimates for a food, either
// from a free-text description (with web search for branded/restaurant
// items) or a photo of a nutrition label. The Anthropic API key lives only
// in this function's environment (set via `supabase secrets set`) and
// never reaches the browser.

import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const SYSTEM_PROMPT = `You are a nutrition estimation assistant for a personal health tracker.

The user logs food one of two ways:

1. A free-text description, sometimes with several components (e.g.
   "chicken burrito bowl with rice, beans, and guac"). For each component,
   estimate calories, protein (g), carbohydrates (g), fat (g), and sodium
   (mg), then sum them into a total. Use web search when the item is a
   specific restaurant or branded product whose nutrition facts are likely
   published online, or when you are not confident in a generic estimate.
   For generic or homemade foods, reasonable standard nutrition values are
   fine without searching.

2. A photo of a nutrition facts label, optionally with a servings count and
   a short note. Read the label's per-serving values exactly as printed and
   multiply by the given servings count (default 1 if not stated). This
   case does not need web search - the label is the source of truth. Set
   confidence to "high" whenever the label is clearly legible.

Always finish by calling submit_nutrition_estimate exactly once with your
final answer, including a confidence level and a brief source_note
explaining where the numbers came from (e.g. "Chipotle's published nutrition
page", "USDA generic estimate for cooked white rice", or "Nutrition label
photo, 2 servings").`

const INGREDIENT_LINES_SYSTEM_PROMPT = `You are a nutrition estimation assistant for a recipe builder.

You will be given a numbered list of ingredient lines exactly as a person
typed them into a recipe. These lines routinely include quirks that are
completely normal and must still be parsed correctly - do not let them
cause you to skip or zero a line:
- Units in any case: "OZ", "oz", "Oz" all mean ounces.
- Parenthetical notes like "(1-can)" or "(15 oz can)" - these describe the
  package, not something to ignore; "15.25 OZ Black Bean (1-can)" means one
  15.25-ounce can of black beans.
- Fractions written as text: "1/4 Cup" means a quarter cup, "1/3" means
  one third.
- Extra descriptive words (e.g. "Rinsed and Drained", "diced", "melted")
  describe preparation, not a different ingredient - estimate nutrition for
  the ingredient as prepared.

For EVERY line given, in the same order, produce exactly one entry in the
"lines" array of your tool call - never skip, merge, or drop a line, even
if several lines describe similar items. For each line:
- If you can confidently identify the food and quantity, set matched=true,
  describe what you interpreted it as in matched_food and the quantity in
  quantity_understood (e.g. "15.25 oz, 1 can"), and give your best nutrition
  estimate for that FULL quantity (not per serving - the recipe builder
  divides by servings itself). Use web search for specific branded/canned
  products when it would improve accuracy.
- If a line is too ambiguous to estimate honestly (e.g. no quantity at all,
  or an item you don't recognize), set matched=false, all numeric fields to
  0, and explain why in note. Do not guess a number just to fill the field -
  an honest "couldn't estimate" is far more useful than a silently wrong
  number.

Always finish by calling submit_ingredient_nutrition exactly once with one
line per input ingredient.`

const NUTRITION_TOOL: Anthropic.Tool = {
  name: 'submit_nutrition_estimate',
  description: 'Submit the final nutrition estimate for the logged food.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            calories: { type: 'number' },
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
            sodium_mg: { type: 'number' },
          },
          required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg'],
          additionalProperties: false,
        },
      },
      total: {
        type: 'object',
        properties: {
          calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          sodium_mg: { type: 'number' },
        },
        required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg'],
        additionalProperties: false,
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      source_note: { type: 'string' },
    },
    required: ['items', 'total', 'confidence', 'source_note'],
    additionalProperties: false,
  },
}

const INGREDIENT_LINES_TOOL: Anthropic.Tool = {
  name: 'submit_ingredient_nutrition',
  description: 'Submit a nutrition estimate for every ingredient line given, one entry per line, in the same order.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            input: { type: 'string' },
            matched: { type: 'boolean' },
            matched_food: { type: 'string' },
            quantity_understood: { type: 'string' },
            calories: { type: 'number' },
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
            sodium_mg: { type: 'number' },
            note: { type: 'string' },
          },
          required: [
            'input',
            'matched',
            'matched_food',
            'quantity_understood',
            'calories',
            'protein_g',
            'carbs_g',
            'fat_g',
            'sodium_mg',
            'note',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['lines'],
    additionalProperties: false,
  },
}

const MAX_TURNS = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: {
    description?: unknown
    imageBase64?: unknown
    imageMediaType?: unknown
    servings?: unknown
    ingredientLines?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const ingredientLines = Array.isArray(body.ingredientLines)
    ? body.ingredientLines.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
    : null

  if (ingredientLines && ingredientLines.length > 0) {
    return handleIngredientLines(ingredientLines)
  }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : null
  const imageMediaType = typeof body.imageMediaType === 'string' ? body.imageMediaType : 'image/jpeg'
  const servings = typeof body.servings === 'number' && body.servings > 0 ? body.servings : 1

  if (!description && !imageBase64) {
    return jsonResponse({ error: 'Provide a "description" and/or a label photo' }, 400)
  }

  // deno-lint-ignore no-explicit-any
  const content: any[] = []
  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageMediaType, data: imageBase64 },
    })
    content.push({
      type: 'text',
      text: description
        ? `Nutrition label photo. Servings: ${servings}. Note: ${description}`
        : `Nutrition label photo. Servings: ${servings}.`,
    })
  } else {
    content.push({ type: 'text', text: description })
  }

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content }]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }, NUTRITION_TOOL],
        messages,
      })

      if (response.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: response.content }]
        continue
      }

      const submitBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_nutrition_estimate',
      )

      if (submitBlock) {
        return jsonResponse(submitBlock.input)
      }

      break
    }
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Nutrition lookup failed' }, 500)
  }

  return jsonResponse({ error: 'Could not produce a nutrition estimate for that description' }, 502)
})

async function handleIngredientLines(ingredientLines: string[]): Promise<Response> {
  const numbered = ingredientLines.map((line, i) => `${i + 1}. ${line}`).join('\n')
  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: numbered }]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: INGREDIENT_LINES_SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }, INGREDIENT_LINES_TOOL],
        messages,
      })

      if (response.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: response.content }]
        continue
      }

      const submitBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_ingredient_nutrition',
      )

      if (submitBlock) {
        return jsonResponse(submitBlock.input)
      }

      break
    }
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Nutrition lookup failed' }, 500)
  }

  return jsonResponse({ error: 'Could not produce a nutrition estimate for those ingredients' }, 502)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
